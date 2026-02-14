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
export async function handleDonationSuccess(ctx: PaymentHandlerContext) {
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

    // Update existing or insert new
    const { data: updated } = await supabaseServer
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
        .match(externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference })
        .select();

    if (!updated?.length) {
        // Fallback insert if not found
        await supabaseServer.from('donations').insert({
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
    }

    // Update Goals
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

    // Notifications
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
}

/* -------------------------------------------------------------------------- */
/*                                 MEMBERSHIP                                 */
/* -------------------------------------------------------------------------- */
export async function handleMembershipSuccess(ctx: PaymentHandlerContext) {
    const { supabaseServer, amountCents, currency, paymentReference, externalReference, method, metadata, customerDetails } = ctx;
    const userId = metadata.userId || null;

    // Update Payment Record
    await supabaseServer
        .from('pagamentos_quotas')
        .update({ estado: 'pago', valor: amountCents / 100, metodo_pagamento: method, payment_intent_id: paymentReference })
        .match(externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference });

    // Check Notification Status
    let paymentRow: any = null;
    try {
        const { data } = await supabaseServer.from('pagamentos_quotas').select('id, email_notificado_at')
            .match(externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference })
            .maybeSingle();
        paymentRow = data;
    } catch { }

    if (userId) {
        // Update Member Status
        const { data: membro } = await supabaseServer.from('membros').select('*').eq('id', userId).single();

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
        }).eq('id', userId);

        // Notifications
        const shouldNotify = !paymentRow?.email_notificado_at;
        if (shouldNotify) {
            const memberEmail = membro?.email || customerDetails?.email;
            // Send standard notification (Membership Paid/Renewed)
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

            // Update flag
            if (paymentRow?.id) await supabaseServer.from('pagamentos_quotas').update({ email_notificado_at: new Date().toISOString() }).eq('id', paymentRow.id);

            // Handle Diploma
            const shouldAttachDiploma = !membro?.diploma_enviado_at && !!numero_socio;
            if (shouldAttachDiploma && memberEmail) {
                const pdfBytes = await generateMemberDiplomaPdf({ memberName: membro.nome, memberNumber: Number(numero_socio), issuedAt: new Date().toISOString() });
                // Send Receipt with Diploma
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
                await supabaseServer.from('membros').update({ diploma_enviado_at: new Date().toISOString() }).eq('id', userId);
            }
        }

        await createAdminNotification('member', wasMember ? 'Renovação' : 'Novo Sócio', `${membro?.nome} - ${amountCents / 100}€`, '/admin/membros');
    }
}

/* -------------------------------------------------------------------------- */
/*                                 PILGRIMAGE                                 */
/* -------------------------------------------------------------------------- */
export async function handlePilgrimageSuccess(ctx: PaymentHandlerContext) {
    const { supabaseServer, amountCents, paymentReference, externalReference, method, metadata } = ctx;
    const bookingId = metadata.booking_id;
    const amountPaid = amountCents / 100;

    if (!bookingId) return;

    const { data: booking } = await supabaseServer.from('bookings').select('paid_amount, pilgrimage:pilgrimages(deposit_value)').eq('id', bookingId).single();
    if (!booking) return;

    const newPaidAmount = (booking.paid_amount || 0) + amountPaid;
    const depositValue = (booking.pilgrimage as any)?.deposit_value || 500;

    const updates: any = { paid_amount: newPaidAmount, last_payment_date: new Date().toISOString() };
    if (newPaidAmount >= depositValue) updates.status = 'confirmed';

    await supabaseServer.from('bookings').update(updates).eq('id', bookingId);

    await supabaseServer.from('pilgrimage_payments').upsert({
        booking_id: bookingId,
        amount: amountPaid,
        payment_intent_id: paymentReference,
        external_reference: externalReference,
        status: 'succeeded',
        method,
        date: new Date().toISOString(),
        notes: `Pagamento via ${method}`
    }, { onConflict: 'external_reference' });

    await createAdminNotification('booking', 'Pagamento Peregrinação', `Reserva #${bookingId} - €${amountPaid.toFixed(2)}`, `/admin/peregrinacoes/inscricao/${bookingId}`);
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
        await supabaseServer.from('donations').update({ status }).match(matchQuery);
    } else if (type === 'membership') {
        await supabaseServer.from('pagamentos_quotas').update({ estado: status }).match(matchQuery);
    } else if (type === 'store') {
        const orderRef = metadata.orderRef;
        if (orderRef) await supabaseServer.from('store_orders').update({ status }).eq('order_ref', orderRef);
    }
}
