import { SupabaseClient } from '@supabase/supabase-js';
import {
    sendMembershipNotification,
    sendMemberReceiptEmail,
    sendMemberDiplomaEmail,
    sendDonationReceiptEmail,
} from './email'; // Assume these exist and are exported
import { ensureNotificationRecord, markNotificationSent } from './email-notifications';
import { processPaidStoreOrder } from './store-orders';
import { generateMemberDiplomaPdf } from './member-diploma';
import { createAdminNotification } from './admin-notifications';
import { calculateNextQuotaDate } from './membership-logic';
import { getNextMemberNumber } from './membership-db';

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

export type PaymentHandlerContext = {
    supabaseServer: SupabaseClient;
    amountCents: number;
    currency: string;
    paymentReference: string; // The ID from the provider (pi_... or Reduniq ID)
    externalReference: string; // Our internal reference or session ID
    method: string; // 'stripe_checkout', 'reduniq', etc.
    metadata: Record<string, any>;
    customerDetails?: {
        name?: string | null;
        email?: string | null;
        address?: any;
        phone?: string | null;
    };
    paymentDate?: Date;
};

/* -------------------------------------------------------------------------- */
/*                                  DONATIONS                                 */
/* -------------------------------------------------------------------------- */
export async function handleDonationSuccess(ctx: PaymentHandlerContext): Promise<boolean> {
    const { supabaseServer, amountCents, currency, paymentReference, externalReference, method, metadata, customerDetails } = ctx;
    const userId = metadata.userId || null;

    const normalizeMeta = (val: any) => val ? String(val).trim() || null : null;
    // donations.method is an enum (stripe_card, bank_transfer, pix).
    // When the provider is Reduniq, we still store it as a card method and keep provider in metadata.
    const dbMethod = method === 'bank_transfer'
        ? 'bank_transfer'
        : method === 'pix'
            ? 'pix'
            : 'stripe_card';

    const donorName = customerDetails?.name || normalizeMeta(metadata.donorName) || null;
    const donorEmail = customerDetails?.email || normalizeMeta(metadata.donorEmail) || null;
    const donorAddress = customerDetails?.address?.line1 || normalizeMeta(metadata.donorAddress) || null;
    const donorCity = customerDetails?.address?.city || normalizeMeta(metadata.donorCity) || null;
    const donorZip = customerDetails?.address?.postal_code || normalizeMeta(metadata.donorZip) || null;
    const donorCountry = customerDetails?.address?.country || normalizeMeta(metadata.donorCountry) || null;
    const donorNif = normalizeMeta(metadata.donorNif);

    // Idempotency: only trigger side-effects when transitioning to succeeded for the first time.
    const matchQuery = externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference };

    // Update only records not yet succeeded. If already succeeded, this returns no rows.
    const { data: transitionedRows } = await supabaseServer
        .from('donations')
        .update({
            status: 'succeeded',
            donor_name: donorName,
            donor_email: donorEmail,
            donor_address: donorAddress,
            donor_city: donorCity,
            donor_zip: donorZip,
            donor_country: donorCountry,
            donor_nif: donorNif,
            method: dbMethod,
            payment_intent_id: paymentReference
        })
        .match(matchQuery)
        .neq('status', 'succeeded')
        .select();

    let didTransitionNow = Boolean(transitionedRows?.length);
    if (!didTransitionNow) {
        const { data: existing } = await supabaseServer
            .from('donations')
            .select('id, status')
            .match(matchQuery)
            .maybeSingle();

        if (!existing) {
            // Fallback insert if not found
            const { error: insertError } = await supabaseServer.from('donations').insert({
                user_id: userId,
                amount_cents: amountCents,
                currency,
                method: dbMethod,
                status: 'succeeded',
                payment_intent_id: paymentReference,
                external_reference: externalReference,
                description: 'Doação',
                donor_name: donorName,
                donor_email: donorEmail,
                donor_nif: donorNif,
            });
            if (!insertError) {
                didTransitionNow = true;
            } else {
                // In case of race/other constraints, do not run side-effects again.
                didTransitionNow = false;
            }
        }
    }

    // If this payment was already processed before, stop here.
    if (!didTransitionNow) {
        return false;
    }

    // Update Goals (first transition only)
    const increment = amountCents / 100;
    if (increment > 0) {
        const { data: metaRow } = await supabaseServer.from('donations_meta').select('id, goal_eur, raised_eur').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const goal = metaRow?.goal_eur ?? 100000;
        const newRaised = Number(metaRow?.raised_eur ?? 0) + increment;
        if (metaRow?.id) {
            await supabaseServer.from('donations_meta').update({ raised_eur: newRaised }).eq('id', metaRow.id);
        } else {
            await supabaseServer.from('donations_meta').insert({ goal_eur: goal, raised_eur: newRaised });
        }
    }

    // Notifications (first transition only)
    if (donorEmail && amountCents > 0) {
        const notif = await ensureNotificationRecord(supabaseServer, { type: 'donation_paid', reference: paymentReference, userId, email: donorEmail });
        if (notif.shouldSend) {
            await sendDonationReceiptEmail({
                toEmail: donorEmail,
                donorName,
                amount: amountCents / 100,
                currency,
                paymentReference,
                paidAt: ctx.paymentDate?.toISOString() || new Date().toISOString(),
                method,
            });
            await markNotificationSent(supabaseServer, notif.recordId);
        }
    }

    await createAdminNotification('donation', 'Nova Doação', `${donorName || 'Anon'} - ${currency} ${(amountCents / 100).toFixed(2)}`, '/admin/doacoes');
    return true;
}

/* -------------------------------------------------------------------------- */
/*                                 MEMBERSHIP                                 */
/* -------------------------------------------------------------------------- */
export async function handleMembershipSuccess(ctx: PaymentHandlerContext): Promise<boolean> {
    const { supabaseServer, amountCents, currency, paymentReference, externalReference, method, metadata, customerDetails } = ctx;
    const userIdFromMeta = metadata.userId || null;
    const matchQuery = externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference };

    // Idempotency: only execute side-effects when transitioning to "pago" for the first time.
    const { data: transitionedRows } = await supabaseServer
        .from('pagamentos_quotas')
        .update({
            estado: 'pago',
            valor: amountCents / 100,
            metodo_pagamento: method,
            payment_intent_id: paymentReference
        })
        .match(matchQuery)
        .neq('estado', 'pago')
        .select('id, user_id, email_notificado_at');

    let paymentRow: any = transitionedRows?.[0] || null;
    let didTransitionNow = !!paymentRow;

    if (!didTransitionNow) {
        const { data: existing } = await supabaseServer
            .from('pagamentos_quotas')
            .select('id, user_id, email_notificado_at, estado')
            .match(matchQuery)
            .maybeSingle();

        if (existing?.estado === 'pago') {
            return false;
        }

        if (existing?.id) {
            const { data: retryRows } = await supabaseServer
                .from('pagamentos_quotas')
                .update({
                    estado: 'pago',
                    valor: amountCents / 100,
                    metodo_pagamento: method,
                    payment_intent_id: paymentReference
                })
                .eq('id', existing.id)
                .neq('estado', 'pago')
                .select('id, user_id, email_notificado_at');
            paymentRow = retryRows?.[0] || null;
            didTransitionNow = !!paymentRow;
        } else {
            // Fallback insert when there is no preliminary record.
            const { data: inserted, error: insertError } = await supabaseServer
                .from('pagamentos_quotas')
                .insert({
                    user_id: userIdFromMeta,
                    valor: amountCents / 100,
                    metodo_pagamento: method,
                    estado: 'pago',
                    payment_intent_id: paymentReference,
                    external_reference: externalReference || null,
                    data_pagamento: formatISODate(ctx.paymentDate || new Date()),
                })
                .select('id, user_id, email_notificado_at')
                .maybeSingle();

            if (!insertError && inserted) {
                paymentRow = inserted;
                didTransitionNow = true;
            }
        }
    }

    if (!didTransitionNow) {
        return false;
    }

    const effectiveUserId = userIdFromMeta || paymentRow?.user_id || null;
    if (!effectiveUserId) {
        return true;
    }

    // Update Member Status
    const { data: membro } = await supabaseServer.from('membros').select('*').eq('id', effectiveUserId).maybeSingle();
    if (!membro) {
        return true;
    }

    const paymentDate = ctx.paymentDate || new Date();
    const nextQuotaDate = calculateNextQuotaDate(paymentDate);
    const wasMember = !!membro?.is_membro;

    // Generate Number if needed
    let numero_socio = membro?.numero_socio;
    if (!numero_socio) {
        numero_socio = await getNextMemberNumber(supabaseServer);
    }

    await supabaseServer.from('membros').update({
        estado_quota: 'pago',
        proxima_quota: formatISODate(nextQuotaDate),
        data_adesao: membro?.data_adesao || formatISODate(new Date()),
        is_membro: true,
        numero_socio,
        updated_at: new Date().toISOString()
    }).eq('id', effectiveUserId);

    // Notifications (first transition only)
    const shouldNotify = !paymentRow?.email_notificado_at;
    if (shouldNotify) {
        const memberEmail = membro?.email || customerDetails?.email;
        await sendMembershipNotification({
            kind: wasMember ? 'renewal' : 'new',
            memberName: membro?.nome,
            memberEmail,
            memberNumber: numero_socio,
            amount: amountCents / 100,
            currency,
            paymentMethod: method,
            paymentReference,
            nextQuotaDate: formatISODate(nextQuotaDate),
            paidAt: paymentDate.toISOString()
        });

        if (paymentRow?.id) {
            await supabaseServer.from('pagamentos_quotas').update({ email_notificado_at: new Date().toISOString() }).eq('id', paymentRow.id);
        }

        // Handle Diploma
        const shouldAttachDiploma = !membro?.diploma_enviado_at && !!numero_socio;
        if (shouldAttachDiploma && memberEmail) {
            const pdfBytes = await generateMemberDiplomaPdf({ memberName: membro.nome, memberNumber: Number(numero_socio), issuedAt: new Date().toISOString() });
            await sendMemberReceiptEmail({
                toEmail: memberEmail,
                memberName: membro.nome,
                memberNumber: numero_socio,
                amount: amountCents / 100,
                currency,
                paymentMethod: method,
                paymentReference,
                nextQuotaDate: formatISODate(nextQuotaDate),
                paidAt: paymentDate.toISOString(),
                kind: wasMember ? 'renewal' : 'new',
                attachments: [{ filename: 'diploma.pdf', content: Buffer.from(pdfBytes), contentType: 'application/pdf' }],
                hasDiploma: true
            });
            await supabaseServer.from('membros').update({ diploma_enviado_at: new Date().toISOString() }).eq('id', effectiveUserId);
        }
    }

    await createAdminNotification('member', wasMember ? 'Renovação' : 'Novo Sócio', `${membro?.nome} - ${amountCents / 100}€`, '/admin/membros');
    return true;
}

/* -------------------------------------------------------------------------- */
/*                                 PILGRIMAGE                                 */
/* -------------------------------------------------------------------------- */
export async function handlePilgrimageSuccess(ctx: PaymentHandlerContext): Promise<boolean> {
    const { supabaseServer, amountCents, paymentReference, externalReference, method, metadata } = ctx;
    const bookingId = metadata.booking_id;
    const amountPaid = amountCents / 100;
    const normalizedMethod = method?.includes('stripe')
        ? 'stripe'
        : method?.includes('reduniq')
            ? 'reduniq'
            : method;

    if (!bookingId) return false;

    const successfulStatuses = ['verified', 'succeeded', 'paid', 'manual'];
    let didTransitionNow = false;

    const { data: existingPayment } = externalReference
        ? await supabaseServer
            .from('pilgrimage_payments')
            .select('id, status')
            .eq('external_reference', externalReference)
            .maybeSingle()
        : { data: null };

    const existingStatus = existingPayment?.status ? String(existingPayment.status).toLowerCase() : null;
    const alreadySucceeded = existingStatus ? successfulStatuses.includes(existingStatus) : false;

    if (!alreadySucceeded) {
        if (existingPayment?.id) {
            const { data: updatedRows } = await supabaseServer
                .from('pilgrimage_payments')
                .update({
                    amount: amountPaid,
                    payment_intent_id: paymentReference,
                    status: 'succeeded',
                    method: normalizedMethod,
                    notes: `Pagamento via ${normalizedMethod}`
                })
                .eq('id', existingPayment.id)
                .not('status', 'in', '(verified,succeeded,paid,manual)')
                .select('id');
            didTransitionNow = Boolean(updatedRows?.length);
        } else {
            const { error: upsertError } = await supabaseServer.from('pilgrimage_payments').upsert({
                booking_id: bookingId,
                amount: amountPaid,
                payment_intent_id: paymentReference,
                external_reference: externalReference,
                status: 'succeeded',
                method: normalizedMethod,
                created_at: new Date().toISOString(),
                notes: `Pagamento via ${normalizedMethod}`
            }, { onConflict: 'external_reference' });

            if (!upsertError) {
                didTransitionNow = true;
            } else {
                const { data: afterRace } = externalReference
                    ? await supabaseServer
                        .from('pilgrimage_payments')
                        .select('status')
                        .eq('external_reference', externalReference)
                        .maybeSingle()
                    : { data: null };
                const afterStatus = afterRace?.status ? String(afterRace.status).toLowerCase() : null;
                didTransitionNow = !!afterStatus && successfulStatuses.includes(afterStatus);
            }
        }
    }

    const { data: paidRows } = await supabaseServer
        .from('pilgrimage_payments')
        .select('amount')
        .eq('booking_id', bookingId)
        .in('status', successfulStatuses);

    const totalPaid = (paidRows || []).reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);

    const { data: booking } = await supabaseServer
        .from('bookings')
        .select('status, pilgrimage_id, pilgrimage:pilgrimages(deposit_value)')
        .eq('id', bookingId)
        .maybeSingle();

    const { count: pilgrimsCount } = await supabaseServer
        .from('pilgrims')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', bookingId);

    const depositValue = Number((booking?.pilgrimage as any)?.deposit_value || 500);
    const requiredDeposit = depositValue * Math.max(1, Number(pilgrimsCount || 1));
    const bookingUpdates: any = {
        paid_amount: totalPaid,
        last_payment_date: new Date().toISOString(),
    };

    if (totalPaid >= requiredDeposit) bookingUpdates.status = 'confirmed';
    await supabaseServer.from('bookings').update(bookingUpdates).eq('id', bookingId);

    if ((booking as any)?.pilgrimage_id) {
        await supabaseServer.rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: (booking as any).pilgrimage_id });
    }

    if (didTransitionNow) {
        await createAdminNotification('booking', 'Pagamento Peregrinação', `Reserva #${bookingId} - €${amountPaid.toFixed(2)}`, `/admin/peregrinacoes/inscricao/${bookingId}`);
    }
    return didTransitionNow;
}

/* -------------------------------------------------------------------------- */
/*                                    STORE                                   */
/* -------------------------------------------------------------------------- */
export async function handleStoreSuccess(ctx: PaymentHandlerContext) {
    const { supabaseServer, amountCents, paymentReference, method, metadata, customerDetails } = ctx;
    const orderRef = metadata.orderRef || metadata.order_ref;

    if (!orderRef) return;

    await processPaidStoreOrder({
        supabaseServer,
        orderRef,
        amountCents,
        paymentReference,
        buyerName: customerDetails?.name,
        buyerEmail: customerDetails?.email,
        buyerPhone: customerDetails?.phone,
        paymentProvider: method.includes('reduniq') ? 'reduniq' : 'stripe',
        paymentMethod: method
    });

    await createAdminNotification('order', 'Nova Encomenda', `Ref: ${orderRef}`, `/admin/encomendas?search=${orderRef}`);
}

/* -------------------------------------------------------------------------- */
/*                               FAILED/CANCELED                              */
/* -------------------------------------------------------------------------- */
export async function handlePaymentFailedOrCanceled(ctx: PaymentHandlerContext, status: 'failed' | 'canceled') {
    const { supabaseServer, externalReference, paymentReference, metadata } = ctx;
    const type = metadata.type;

    const matchQuery = externalReference
        ? { external_reference: externalReference }
        : { payment_intent_id: paymentReference };

    if (type === 'donation') {
        await supabaseServer.from('donations').update({ status }).match(matchQuery).eq('status', 'pending');
    } else if (type === 'membership') {
        await supabaseServer.from('pagamentos_quotas').update({ estado: status }).match(matchQuery).eq('estado', 'pendente');
    } else if (type === 'pilgrimage' || type === 'pilgrimage_payment') {
        const nextStatus = status === 'canceled' ? 'failed' : status;
        await supabaseServer
            .from('pilgrimage_payments')
            .update({ status: nextStatus })
            .match(matchQuery)
            .eq('status', 'pending');
    } else if (type === 'store') {
        const orderRef = metadata.orderRef;
        if (orderRef) await supabaseServer.from('store_orders').update({ status }).eq('order_ref', orderRef).eq('status', 'pending');
    }
}
