import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getReduniqResult } from '../../../../lib/reduniq';
import { sendDonationReceiptEmail, sendMemberReceiptEmail, sendMembershipNotification } from '../../../../lib/email';
import { processPaidStoreOrder } from '../../../../lib/store-orders';
import { supabaseServer } from '../../../../lib/supabase';
import { ensureNotificationRecord, markNotificationSent } from '../../../../lib/email-notifications';
import {
  buildDonationInvoiceInput,
  buildMembershipInvoiceInput,
  buildStoreInvoiceInput,
  issueFactPtInvoice,
} from '../../../../lib/factpt-issuer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(1),
  type: z.enum(['donation', 'membership', 'store']).optional(),
  userId: z.string().optional(),
});

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

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

const mapPrivateData = (entries?: Array<{ name?: string; value?: string }>) => {
  if (!entries) return {};
  return entries.reduce<Record<string, string>>((acc, item) => {
    if (item?.name && typeof item.value === 'string') {
      acc[item.name] = item.value;
    }
    return acc;
  }, {});
};

const mapStatus = (status?: string) => {
  if (status === '4') return 'success';
  if (status === '3') return 'failed';
  if (status === '1' || status === '2') return 'pending';
  return 'unknown';
};

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { token, type: fallbackType, userId: fallbackUserId } = bodySchema.parse(json);

    const result = await getReduniqResult(token);
    const transactionStatus = result?.transaction?.status;
    const status = mapStatus(transactionStatus);
    const privateData = mapPrivateData(result?.privateData);

    const type = (privateData.type as 'donation' | 'membership' | 'store' | undefined) || fallbackType;
    const userId = privateData.userId || fallbackUserId || null;
    const amountCents = Number.parseInt(result?.payment?.amount || '0', 10);
    const amount = Number.isFinite(amountCents) ? amountCents / 100 : null;
    const solution = result?.payment?.solution ? `reduniq_${result.payment.solution}` : 'reduniq';
    const donorName = privateData.donorName || null;
    const donorEmail = privateData.donorEmail || null;
    const donorAddress = privateData.donorAddress || null;
    const donorCity = privateData.donorCity || null;
    const donorZip = privateData.donorZip || null;
    const donorCountry = privateData.donorCountry ? privateData.donorCountry.toUpperCase() : null;
    const donorNif = privateData.donorNif || null;

    if (supabaseServer && type && type !== 'store') {
      try {
        if (type === 'donation') {
          const newStatus =
            status === 'success' ? 'succeeded' : status === 'failed' ? 'failed' : 'pending';

          const donationUpdate: Record<string, any> = {
            status: newStatus,
            amount_cents: amountCents || null,
            method: solution,
          };
          if (donorName) donationUpdate.donor_name = donorName;
          if (donorEmail) donationUpdate.donor_email = donorEmail;
          if (donorAddress) donationUpdate.donor_address = donorAddress;
          if (donorCity) donationUpdate.donor_city = donorCity;
          if (donorZip) donationUpdate.donor_zip = donorZip;
          if (donorCountry) donationUpdate.donor_country = donorCountry;
          if (donorNif) donationUpdate.donor_nif = donorNif;

          const { data: updated, error: updErr } = await supabaseServer
            .from('donations')
            .update(donationUpdate)
            .eq('external_reference', token)
            .select();

          if (updErr) throw updErr;

          if (!updated?.length) {
            await supabaseServer.from('donations').insert({
              user_id: userId,
              amount_cents: amountCents || null,
              currency: 'EUR',
              method: solution,
              status: newStatus,
              payment_intent_id: null,
              external_reference: token,
              description: 'Doação (reduniq)',
              donor_name: donorName,
              donor_email: donorEmail,
              donor_address: donorAddress,
              donor_city: donorCity,
              donor_zip: donorZip,
              donor_country: donorCountry,
              donor_nif: donorNif,
            });
          }

          if (status === 'success' && amountCents > 0) {
            const increment = amountCents / 100;
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
              await supabaseServer.from('donations_meta').insert({ goal_eur: goal, raised_eur: newRaised });
            }

            if (userId) {
              const { data: donor } = await supabaseServer
                .from('membros')
                .select('email, nome')
                .eq('id', userId)
                .maybeSingle();

              const donorEmail = donor?.email ?? null;
              if (donorEmail) {
                const notification = await ensureNotificationRecord(supabaseServer, {
                  type: 'donation_paid',
                  reference: token,
                  userId,
                  email: donorEmail,
                });
                if (notification.shouldSend) {
                  await sendDonationReceiptEmail({
                    toEmail: donorEmail,
                    donorName: donor?.nome ?? null,
                    amount: amountCents / 100,
                    currency: 'EUR',
                    paymentReference: token,
                    paidAt: new Date().toISOString(),
                    method: solution,
                  });
                  await markNotificationSent(supabaseServer, notification.recordId);
                }
              }
            }

            try {
              const donationInput = await buildDonationInvoiceInput({
                sourceRef: token,
                amount: amountCents / 100,
                paymentMethod: solution,
                userId,
                donor: {
                  name: donorName,
                  email: donorEmail,
                  nif: donorNif,
                  address: donorAddress,
                  city: donorCity,
                  zip: donorZip,
                  country: donorCountry,
                },
              });
              if (donationInput) {
                await issueFactPtInvoice(donationInput);
              }
            } catch (err) {
              console.warn('Fact.pt doacao falhou:', err);
            }
          }
        }

        if (type === 'membership') {
          const newStatus = status === 'success' ? 'pago' : status === 'failed' ? 'failed' : 'pendente';

          const { data: updated, error: updErr } = await supabaseServer
            .from('pagamentos_quotas')
            .update({ estado: newStatus, valor: amount, metodo_pagamento: solution })
            .eq('external_reference', token)
            .select();

          if (updErr) throw updErr;

          if (!updated?.length) {
            await supabaseServer.from('pagamentos_quotas').insert({
              user_id: userId,
              valor: amount,
              metodo_pagamento: solution,
              estado: newStatus,
              payment_intent_id: null,
              external_reference: token,
              data_pagamento: new Date().toISOString().slice(0, 10),
            });
          }

          let paymentRow: { id: string; email_notificado_at: string | null } | null = null;
          try {
            const { data } = await supabaseServer
              .from('pagamentos_quotas')
              .select('id, email_notificado_at')
              .eq('external_reference', token)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            paymentRow = data ?? null;
          } catch (err) {
            console.warn('Nao foi possivel validar email_notificado_at:', err);
          }

          if (status === 'success' && userId) {
            const amountValue = Number(amount ?? 0);
            const { data: membro } = await supabaseServer
              .from('membros')
              .select('proxima_quota, data_adesao, numero_socio, is_membro, nome, email')
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
                    memberEmail: membro?.email ?? null,
                    memberNumber: numero_socio ?? membro?.numero_socio ?? null,
                    amount: amountValue,
                    currency: 'EUR',
                    paymentMethod: solution ? `reduniq_${solution}` : 'reduniq',
                    paymentReference: token,
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

                const memberEmail = membro?.email ?? null;
                if (memberEmail) {
                  const notification = await ensureNotificationRecord(supabaseServer, {
                    type: wasMember ? 'membership_renewal' : 'membership_paid',
                    reference: token,
                    userId,
                    email: memberEmail,
                  });
                  if (notification.shouldSend) {
                    await sendMemberReceiptEmail({
                      toEmail: memberEmail,
                      memberName: membro?.nome ?? null,
                      memberNumber: numero_socio ?? membro?.numero_socio ?? null,
                      amount: amountValue,
                      currency: 'EUR',
                      paymentMethod: solution ? `reduniq_${solution}` : 'reduniq',
                      paymentReference: token,
                      nextQuotaDate: formatISODate(nextQuotaDate),
                      paidAt: new Date().toISOString(),
                      kind: wasMember ? 'renewal' : 'new',
                    });
                    await markNotificationSent(supabaseServer, notification.recordId);
                  }
                }
              } catch (err) {
                console.error('Erro ao enviar email de quota:', err);
              }
            }

            if (amountValue > 0) {
              try {
                const membershipInput = await buildMembershipInvoiceInput({
                  sourceRef: token,
                  amount: amountValue,
                  paymentMethod: solution,
                  userId,
                });
                if (membershipInput) {
                  await issueFactPtInvoice(membershipInput);
                }
              } catch (err) {
                console.warn('Fact.pt quota falhou:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('Erro ao atualizar estado REDUNIQ no Supabase:', err);
      }
    }

    if (supabaseServer && type === 'store') {
      try {
        const orderRef = privateData.orderRef;
        if (orderRef) {
          const newStatus = status === 'success' ? 'paid' : status === 'failed' ? 'failed' : 'pending';
          if (newStatus !== 'paid') {
            await supabaseServer
              .from('store_orders')
              .update({
                status: newStatus,
                payment_method: solution,
                total_amount: amount ?? null,
                payment_reference: token,
              })
              .eq('order_ref', orderRef);
          } else {
            await processPaidStoreOrder({
              supabaseServer,
              orderRef,
              amountCents,
              paymentReference: token,
              paymentProvider: 'reduniq',
              paymentMethod: solution,
            });
            try {
              const storeInput = await buildStoreInvoiceInput({
                orderRef,
                paymentMethod: solution,
              });
              if (storeInput) {
                await issueFactPtInvoice(storeInput);
              }
            } catch (err) {
              console.warn('Fact.pt loja falhou:', err);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao atualizar pedido da loja:', err);
      }
    }

    return NextResponse.json({
      status,
      transactionStatus,
      resultCode: result?.result?.code,
      resultMessage: result?.result?.message,
      amount,
      solution: result?.payment?.solution ?? null,
    });
  } catch (err: any) {
    console.error('Erro em /api/reduniq/result:', err);
    const message = err?.message || 'Erro ao consultar pagamento REDUNIQ.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
