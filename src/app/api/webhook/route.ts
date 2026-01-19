import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '../../../lib/payments';
import { supabaseServer } from '../../../lib/supabase';
import {
  sendMembershipNotification,
  sendMemberReceiptEmail,
  sendMemberDiplomaEmail,
  sendDonationReceiptEmail,
} from '../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../lib/email-notifications';
import { processPaidStoreOrder } from '../../../lib/store-orders';
import { generateMemberDiplomaPdf } from '../../../lib/member-diploma';
import {
  buildDonationInvoiceInput,
  buildMembershipInvoiceInput,
  buildStoreInvoiceInput,
  issueFactPtInvoice,
} from '../../../lib/factpt-issuer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Health check / to avoid 405 noise from misrouted requests
  return NextResponse.json({ ok: true });
}

export async function HEAD() {
  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

// Gera próxima quota sempre a 31 de janeiro (ano atual ou seguinte) conforme regra de negócio
const calculateNextQuotaDate = (currentDueDate?: string | null) => {
  const today = new Date();

  if (currentDueDate) {
    const currentDue = new Date(currentDueDate);
    return new Date(currentDue.getFullYear() + 1, 0, 31);
  }

  const jan31CurrentYear = new Date(today.getFullYear(), 0, 31);
  if (today <= jan31CurrentYear) {
    return jan31CurrentYear;
  }
  return new Date(today.getFullYear() + 1, 0, 31);
};

const calculateExpirationDate = (quotaDate: Date) => {
  const expiration = new Date(quotaDate);
  expiration.setDate(quotaDate.getDate() + 1);
  return expiration;
};

const normalizeMeta = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getNextMemberNumber = async (supabaseServer: any) => {
  const { data, error } = await supabaseServer
    .from('membros')
    .select('numero_socio')
    .not('numero_socio', 'is', null)
    .order('numero_socio', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const current = Number(data?.numero_socio ?? 0);
  return Number.isFinite(current) && current > 0 ? current + 1 : 1;
};

export async function POST(request: Request) {
  if (!stripe) return NextResponse.json({ message: 'Stripe não configurado' }, { status: 500 });

  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ message: 'Assinatura ausente' }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await request.text();

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err?.message);
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const type = (session.metadata?.type as 'donation' | 'membership' | 'store' | 'pilgrimage_payment' | undefined) ?? 'donation';
    const userId = session.metadata?.userId || null;
    const amountCents = session.amount_total ?? 0;
    const paymentIntent = session.payment_intent as string | null;
    const externalRef = session.id;
    const orderRef = session.metadata?.orderRef || session.metadata?.order_ref || null;

    if (supabaseServer) {
      try {
        if (type === 'donation') {
          const meta = session.metadata || {};
          const donorNameMeta = normalizeMeta(meta.donorName);
          const donorEmailMeta = normalizeMeta(meta.donorEmail);
          const donorAddressMeta = normalizeMeta(meta.donorAddress);
          const donorCityMeta = normalizeMeta(meta.donorCity);
          const donorZipMeta = normalizeMeta(meta.donorZip);
          const donorCountryMeta = normalizeMeta(meta.donorCountry)?.toUpperCase() || null;
          const donorNifMeta = normalizeMeta(meta.donorNif);
          const address = session.customer_details?.address || null;
          const donorName = session.customer_details?.name || donorNameMeta || null;
          const donorEmail = session.customer_details?.email || donorEmailMeta || null;
          const donorAddress = address?.line1 || address?.line2 || donorAddressMeta || null;
          const donorCity = address?.city || donorCityMeta || null;
          const donorZip = address?.postal_code || donorZipMeta || null;
          const donorCountry = address?.country || donorCountryMeta || null;

          const donationUpdate: Record<string, any> = { status: 'succeeded' };
          if (donorName) donationUpdate.donor_name = donorName;
          if (donorEmail) donationUpdate.donor_email = donorEmail;
          if (donorAddress) donationUpdate.donor_address = donorAddress;
          if (donorCity) donationUpdate.donor_city = donorCity;
          if (donorZip) donationUpdate.donor_zip = donorZip;
          if (donorCountry) donationUpdate.donor_country = donorCountry;
          if (donorNifMeta) donationUpdate.donor_nif = donorNifMeta;

          const { data: updated, error: updErr } = await supabaseServer
            .from('donations')
            .update(donationUpdate)
            .not('status', 'eq', 'succeeded')
            .or(
              [
                paymentIntent ? `payment_intent_id.eq.${paymentIntent}` : '',
                `external_reference.eq.${externalRef}`,
              ].filter(Boolean).join(','),
            )
            .select();

          if (updErr) throw updErr;
          const updatedCount = updated?.length ?? 0;

          if (!updatedCount) {
            await supabaseServer.from('donations').upsert(
              {
                user_id: userId,
                amount_cents: amountCents,
                currency: session.currency?.toUpperCase() ?? 'EUR',
                method: 'stripe_checkout',
                status: 'succeeded',
                payment_intent_id: paymentIntent,
                external_reference: externalRef,
                description: 'Doação (checkout)',
                donor_name: donorName,
                donor_email: donorEmail,
                donor_address: donorAddress,
                donor_city: donorCity,
                donor_zip: donorZip,
                donor_country: donorCountry,
                donor_nif: donorNifMeta,
              },
              { onConflict: 'external_reference' },
            );
          }

          // Atualiza goal/raised em donations_meta (acumula se foi atualizado ou inserido)
          const increment = amountCents / 100;
          if (increment > 0) {
            const { data: metaRow } = await supabaseServer
              .from('donations_meta')
              .select('id, goal_eur, raised_eur')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const goal = metaRow?.goal_eur ?? 100000;
            const currentRaised = metaRow?.raised_eur ?? 0;
            const newRaised = Number(currentRaised) + increment;

            if (metaRow?.id) {
              await supabaseServer
                .from('donations_meta')
                .update({ raised_eur: newRaised, goal_eur: goal })
                .eq('id', metaRow.id);
            } else {
              await supabaseServer
                .from('donations_meta')
                .insert({ goal_eur: goal, raised_eur: newRaised });
            }
          }

          if (donorEmail && amountCents > 0) {
            const donationRef = paymentIntent || externalRef;
            const notification = await ensureNotificationRecord(supabaseServer, {
              type: 'donation_paid',
              reference: donationRef,
              userId,
              email: donorEmail,
            });
            if (notification.shouldSend) {
              try {
                await sendDonationReceiptEmail({
                  toEmail: donorEmail,
                  donorName,
                  amount: amountCents / 100,
                  currency: session.currency?.toUpperCase() ?? 'EUR',
                  paymentReference: donationRef,
                  paidAt: new Date().toISOString(),
                  method: 'stripe_checkout',
                });
                await markNotificationSent(supabaseServer, notification.recordId);
              } catch (err) {
                console.error('Erro ao enviar email de doacao:', err);
              }
            }
          }

          if (amountCents > 0) {
            try {
              const donationInput = await buildDonationInvoiceInput({
                sourceRef: paymentIntent || externalRef,
                amount: amountCents / 100,
                paymentMethod: 'stripe_checkout',
                userId,
                donor: {
                  name: donorName,
                  email: donorEmail,
                  nif: donorNifMeta || null,
                  address: donorAddress,
                  city: donorCity,
                  zip: donorZip,
                  country: donorCountry,
                  phone: session.customer_details?.phone || null,
                },
              });
              if (donationInput) {
                await issueFactPtInvoice(donationInput);
              }
            } catch (err) {
              console.warn('Fact.pt doacao falhou:', err);
            }
          }
        } else if (type === 'membership') {
          const { data: updated, error: updErr } = await supabaseServer
            .from('pagamentos_quotas')
            .update({ estado: 'pago', valor: amountCents / 100 })
            .or(
              [
                paymentIntent ? `payment_intent_id.eq.${paymentIntent}` : '',
                `external_reference.eq.${externalRef}`,
              ].filter(Boolean).join(','),
            )
            .select();
          if (updErr) throw updErr;

          const updatedCount = updated?.length ?? 0;

          if (!updatedCount) {
            await supabaseServer.from('pagamentos_quotas').upsert(
              {
                user_id: userId,
                valor: amountCents / 100,
                metodo_pagamento: 'stripe_checkout',
                estado: 'pago',
                payment_intent_id: paymentIntent,
                external_reference: externalRef,
                data_pagamento: new Date().toISOString().slice(0, 10),
              },
              { onConflict: 'external_reference' },
            );
          }

          let paymentRow: { id: string; email_notificado_at: string | null } | null = null;
          try {
            const { data } = await supabaseServer
              .from('pagamentos_quotas')
              .select('id, email_notificado_at')
              .or(
                [
                  paymentIntent ? `payment_intent_id.eq.${paymentIntent}` : '',
                  `external_reference.eq.${externalRef}`,
                ].filter(Boolean).join(','),
              )
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            paymentRow = data ?? null;
          } catch (err) {
            console.warn('Nao foi possivel validar email_notificado_at:', err);
          }

          // Atualiza membro com estado pago e próximas datas (31 de janeiro)
          if (userId) {
            const { data: membro } = await supabaseServer
              .from('membros')
              .select('proxima_quota, data_adesao, numero_socio, is_membro, nome, email, diploma_enviado_at')
              .eq('id', userId)
              .maybeSingle();

            const nextQuotaDate = calculateNextQuotaDate(membro?.proxima_quota);
            const expirationDate = calculateExpirationDate(nextQuotaDate);
            const adesao = membro?.data_adesao ? membro.data_adesao : formatISODate(new Date());
            const shouldAssignMemberNumber = !membro?.numero_socio || !membro?.is_membro;
            const wasMember = !!membro?.is_membro;
            let numero_socio: number | undefined;

            if (shouldAssignMemberNumber) {
              try {
                numero_socio = await getNextMemberNumber(supabaseServer);
              } catch (err) {
                console.error('Erro ao obter número de sócio:', err);
              }
            }

            const { error: membroUpdateError } = await supabaseServer
              .from('membros')
              .update({
                is_membro: true,
                estado_quota: 'pago',
                proxima_quota: formatISODate(nextQuotaDate),
                data_expiracao: formatISODate(expirationDate),
                data_adesao: adesao,
                updated_at: new Date().toISOString(),
                ...(Number.isFinite(numero_socio) ? { numero_socio } : {}),
              })
              .eq('id', userId);
            if (membroUpdateError) {
              console.error('Erro ao atualizar membro após pagamento:', membroUpdateError);
            } else {
              try {
                const shouldNotify = !paymentRow?.email_notificado_at;
                if (shouldNotify) {
                  await sendMembershipNotification({
                    kind: wasMember ? 'renewal' : 'new',
                    memberName: membro?.nome ?? null,
                    memberEmail: membro?.email ?? session.customer_details?.email ?? null,
                    memberNumber: numero_socio ?? membro?.numero_socio ?? null,
                    amount: amountCents / 100,
                    currency: session.currency?.toUpperCase() ?? 'EUR',
                    paymentMethod: 'stripe_checkout',
                    paymentReference: paymentIntent || externalRef,
                    nextQuotaDate: formatISODate(nextQuotaDate),
                    paidAt: new Date().toISOString(),
                  });

                  if (paymentRow?.id) {
                    try {
                      await supabaseServer
                        .from('pagamentos_quotas')
                        .update({ email_notificado_at: new Date().toISOString() })
                        .eq('id', paymentRow.id);
                    } catch (err) {
                      console.warn('Nao foi possivel marcar email_notificado_at:', err);
                    }
                  }
                }

                const { data: updatedMember } = await supabaseServer
                  .from('membros')
                  .select('nome, email, numero_socio, diploma_enviado_at')
                  .eq('id', userId)
                  .maybeSingle();

                const memberEmail = updatedMember?.email ?? membro?.email ?? session.customer_details?.email ?? null;
                if (memberEmail) {
                  const membershipRef = paymentIntent || externalRef;
                  const finalMemberNumber =
                    updatedMember?.numero_socio ?? numero_socio ?? membro?.numero_socio ?? null;
                  const shouldAttachDiploma = !updatedMember?.diploma_enviado_at && !!finalMemberNumber;
                  let diplomaAttachment: { filename: string; content: Buffer; contentType?: string } | undefined;

                  if (shouldAttachDiploma) {
                    try {
                      const pdfBytes = await generateMemberDiplomaPdf({
                        memberName: updatedMember?.nome || membro?.nome || memberEmail,
                        memberNumber: Number(finalMemberNumber),
                        issuedAt: new Date().toISOString(),
                      });
                      console.log('Diploma PDF gerado:', {
                        bytes: pdfBytes?.length ?? null,
                        memberNumber: finalMemberNumber,
                        memberEmail,
                      });
                      diplomaAttachment = {
                        filename: `diploma-socio-${finalMemberNumber}.pdf`,
                        content: Buffer.from(pdfBytes),
                        contentType: 'application/pdf',
                      };
                      console.log('Diploma attachment pronto:', {
                        filename: diplomaAttachment.filename,
                        size: diplomaAttachment.content?.length ?? null,
                      });
                    } catch (err) {
                      console.error('Erro ao gerar diploma:', err);
                    }
                  }
                  console.log('Diploma check:', {
                    wasMember,
                    diplomaEnviado: updatedMember?.diploma_enviado_at,
                    memberNumber: finalMemberNumber,
                    shouldAttachDiploma,
                  });

                  const notification = await ensureNotificationRecord(supabaseServer, {
                    type: wasMember ? 'membership_renewal' : 'membership_paid',
                    reference: membershipRef,
                    userId,
                    email: memberEmail,
                  });
                  if (notification.shouldSend) {
                    const sent = await sendMemberReceiptEmail({
                      toEmail: memberEmail,
                      memberName: updatedMember?.nome ?? membro?.nome ?? null,
                      memberNumber: finalMemberNumber,
                      amount: amountCents / 100,
                      currency: session.currency?.toUpperCase() ?? 'EUR',
                      paymentMethod: 'stripe_checkout',
                      paymentReference: membershipRef,
                      nextQuotaDate: formatISODate(nextQuotaDate),
                      paidAt: new Date().toISOString(),
                      kind: wasMember ? 'renewal' : 'new',
                      attachments: diplomaAttachment ? [diplomaAttachment] : undefined,
                      hasDiploma: !!diplomaAttachment,
                    });

                    console.log('Email inscricao confirmada enviado:', {
                      sent,
                      hasDiploma: !!diplomaAttachment,
                      memberEmail,
                    });

                    if (sent) {
                      await markNotificationSent(supabaseServer, notification.recordId);
                    }

                    if (sent && shouldAttachDiploma) {
                      try {
                        await supabaseServer
                          .from('membros')
                          .update({ diploma_enviado_at: new Date().toISOString() })
                          .eq('id', userId);
                      } catch (err) {
                        console.warn('Nao foi possivel marcar diploma_enviado_at:', err);
                      }
                    }
                  } else if (shouldAttachDiploma && diplomaAttachment) {
                    const diplomaSent = await sendMemberDiplomaEmail({
                      toEmail: memberEmail,
                      memberName: updatedMember?.nome ?? membro?.nome ?? null,
                      memberNumber: Number(finalMemberNumber),
                      issuedAt: new Date().toISOString(),
                      attachments: [diplomaAttachment],
                    });
                    if (diplomaSent) {
                      try {
                        await supabaseServer
                          .from('membros')
                          .update({ diploma_enviado_at: new Date().toISOString() })
                          .eq('id', userId);
                      } catch (err) {
                        console.warn('Nao foi possivel marcar diploma_enviado_at:', err);
                      }
                    }
                  }
                }
              } catch (err) {
                console.error('Erro ao enviar email de quota:', err);
              }
            }
          }

          if (userId && amountCents > 0) {
            try {
              const membershipInput = await buildMembershipInvoiceInput({
                sourceRef: paymentIntent || externalRef,
                amount: amountCents / 100,
                paymentMethod: 'stripe_checkout',
                userId,
              });
              if (membershipInput) {
                await issueFactPtInvoice(membershipInput);
              }
            } catch (err) {
              console.warn('Fact.pt quota falhou:', err);
            }
          }
        } else if (type === 'pilgrimage_payment') {
          const bookingId = session.metadata?.booking_id;
          const amountPaid = amountCents / 100;

          if (bookingId) {
            // 1. Fetch current booking status
            const { data: booking, error: fetchErr } = await supabaseServer
              .from('bookings')
              .select('paid_amount, pilgrimage:pilgrimages(deposit_value)')
              .eq('id', bookingId)
              .single();

            if (!fetchErr && booking) {
              const newPaidAmount = (booking.paid_amount || 0) + amountPaid;
              const depositValue = (booking.pilgrimage as any)?.deposit_value || 500;

              let updates: any = {
                paid_amount: newPaidAmount,
                last_payment_date: new Date().toISOString()
              };

              // Auto-confirm if they paid at least the deposit
              if (newPaidAmount >= depositValue) {
                updates.status = 'confirmed';
              }

              await supabaseServer
                .from('bookings')
                .update(updates)
                .eq('id', bookingId);

              // 2. Record Payment Detail
              await supabaseServer
                .from('pilgrimage_payments')
                .upsert({
                  booking_id: bookingId,
                  amount: amountPaid,
                  payment_intent_id: paymentIntent,
                  external_reference: externalRef,
                  status: 'succeeded',
                  method: 'stripe',
                  date: new Date().toISOString(),
                  notes: 'Pagamento via Stripe (Automático)'
                }, { onConflict: 'external_reference' });

              console.log(`✅ [Webhook] Pilgrimage payment recorded for Booking ${bookingId}: ${amountPaid}€`);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao gravar no Supabase:', err);
      }
    }

    // Loja (Stripe)
    if (type === 'store' && supabaseServer && orderRef) {
      try {
        await processPaidStoreOrder({
          supabaseServer,
          orderRef,
          amountCents,
          paymentReference: paymentIntent || externalRef,
          buyerName: session.customer_details?.name || null,
          buyerEmail: session.customer_details?.email || null,
          buyerPhone: session.customer_details?.phone || null,
          paymentProvider: 'stripe',
          paymentMethod: 'stripe_checkout',
        });
        try {
          const storeInput = await buildStoreInvoiceInput({
            orderRef,
            paymentMethod: 'stripe_checkout',
          });
          if (storeInput) {
            await issueFactPtInvoice(storeInput);
          }
        } catch (err) {
          console.warn('Fact.pt loja falhou:', err);
        }
      } catch (err) {
        console.error('Erro ao processar encomenda da loja (Stripe):', err);
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const paymentIntent = pi.id;
    const externalRef = pi.metadata?.checkout_session_id || null;
    const type = (pi.metadata?.type as 'donation' | 'membership' | 'store' | undefined) ?? undefined;

    if (supabaseServer) {
      try {
        if (type === 'donation') {
          await supabaseServer
            .from('donations')
            .update({ status: 'failed' })
            .or(
              [
                `payment_intent_id.eq.${paymentIntent}`,
                externalRef ? `external_reference.eq.${externalRef}` : '',
              ].filter(Boolean).join(','),
            );
        } else if (type === 'membership') {
          await supabaseServer
            .from('pagamentos_quotas')
            .update({ estado: 'failed' })
            .or(
              [
                `payment_intent_id.eq.${paymentIntent}`,
                externalRef ? `external_reference.eq.${externalRef}` : '',
              ].filter(Boolean).join(','),
            );
        } else if (type === 'store') {
          const orderRef = pi.metadata?.orderRef || pi.metadata?.order_ref || null;
          if (orderRef) {
            await supabaseServer
              .from('store_orders')
              .update({
                status: 'failed',
                payment_provider: 'stripe',
                payment_method: 'stripe_checkout',
                payment_reference: paymentIntent,
              })
              .eq('order_ref', orderRef);
          }
        }
      } catch (err) {
        console.error('Erro ao marcar falha:', err);
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntent = session.payment_intent as string | null;
    const externalRef = session.id;
    const type = (session.metadata?.type as 'donation' | 'membership' | 'store' | undefined) ?? undefined;

    if (supabaseServer) {
      try {
        if (type === 'donation') {
          await supabaseServer
            .from('donations')
            .update({ status: 'canceled' })
            .or(
              [
                paymentIntent ? `payment_intent_id.eq.${paymentIntent}` : '',
                `external_reference.eq.${externalRef}`,
              ].filter(Boolean).join(','),
            );
        } else if (type === 'membership') {
          await supabaseServer
            .from('pagamentos_quotas')
            .update({ estado: 'canceled' })
            .or(
              [
                paymentIntent ? `payment_intent_id.eq.${paymentIntent}` : '',
                `external_reference.eq.${externalRef}`,
              ].filter(Boolean).join(','),
            );
        } else if (type === 'store') {
          const orderRef = session.metadata?.orderRef || session.metadata?.order_ref || null;
          if (orderRef) {
            await supabaseServer
              .from('store_orders')
              .update({
                status: 'canceled',
                payment_provider: 'stripe',
                payment_method: 'stripe_checkout',
                payment_reference: paymentIntent || externalRef,
              })
              .eq('order_ref', orderRef);
          }
        }
      } catch (err) {
        console.error('Erro ao marcar expirado:', err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
