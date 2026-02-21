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

const ensureUniqueMemberNumber = async (
    supabaseServer: SupabaseClient,
    userId: string,
    candidate: number | null | undefined,
) => {
    const numericCandidate = Number(candidate ?? 0);
    if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
        const { data: conflictRows } = await supabaseServer
            .from('membros')
            .select('id')
            .eq('numero_socio', numericCandidate)
            .neq('id', userId)
            .limit(1);

        if (!conflictRows || conflictRows.length === 0) {
            return numericCandidate;
        }
    }

    return getNextMemberNumber(supabaseServer);
};

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
    const parseBoolMeta = (val: any): boolean | null => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
            const v = val.trim().toLowerCase();
            if (v === 'true') return true;
            if (v === 'false') return false;
        }
        return null;
    };

    const reduniqMethodHint = normalizeMeta(
        metadata.reduniqMethod ||
        metadata.reduniq_method ||
        metadata.paymentOptionId ||
        metadata.payment_option_id
    );

    // donations.method is an enum (stripe_card, bank_transfer, pix).
    // When the provider is Reduniq, we still store it as a card method and keep provider in metadata.
    const dbMethod = method === 'bank_transfer'
        ? 'bank_transfer'
        : method === 'pix' || (reduniqMethodHint?.toLowerCase().includes('pix') ?? false)
            ? 'pix'
            : method === 'stripe_apple_pay'
                ? 'stripe_apple_pay'
                : 'stripe_card';

    const donorName = customerDetails?.name || normalizeMeta(metadata.donorName) || null;
    const donorEmail = customerDetails?.email || normalizeMeta(metadata.donorEmail) || null;
    const donorAddress = customerDetails?.address?.line1 || normalizeMeta(metadata.donorAddress) || null;
    const donorCity = customerDetails?.address?.city || normalizeMeta(metadata.donorCity) || null;
    const donorZip = customerDetails?.address?.postal_code || normalizeMeta(metadata.donorZip) || null;
    const donorCountry = customerDetails?.address?.country || normalizeMeta(metadata.donorCountry) || null;
    const donorNif = normalizeMeta(metadata.donorNif);
    const receiptRequiredMeta = parseBoolMeta(metadata.receiptRequired);

    const matchQuery = externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference };

    const { data: existingDonation } = await supabaseServer
        .from('donations')
        .select('id, metadata, donor_name, donor_email, donor_address, donor_city, donor_zip, donor_country, donor_nif, receipt_required')
        .match(matchQuery)
        .maybeSingle();

    const mergedMetadata = {
        ...(existingDonation?.metadata || {}),
        provider: method === 'reduniq' ? 'reduniq' : ((existingDonation?.metadata as any)?.provider || 'stripe'),
        reduniq_method: reduniqMethodHint || (existingDonation?.metadata as any)?.reduniq_method || null,
        donorAddress: donorAddress ?? (existingDonation?.metadata as any)?.donorAddress ?? null,
        donorCity: donorCity ?? (existingDonation?.metadata as any)?.donorCity ?? null,
        donorZip: donorZip ?? (existingDonation?.metadata as any)?.donorZip ?? null,
        donorCountry: donorCountry ?? (existingDonation?.metadata as any)?.donorCountry ?? null,
        donorNif: donorNif ?? (existingDonation?.metadata as any)?.donorNif ?? null,
        donorName: donorName ?? (existingDonation?.metadata as any)?.donorName ?? null,
        donorEmail: donorEmail ?? (existingDonation?.metadata as any)?.donorEmail ?? null,
        receiptRequired: receiptRequiredMeta ?? (existingDonation?.metadata as any)?.receiptRequired ?? null,
    };

    // Update existing or insert new
    const { data: updated } = await supabaseServer
        .from('donations')
        .update({
            status: 'succeeded',
            donor_name: donorName ?? existingDonation?.donor_name ?? null,
            donor_email: donorEmail ?? existingDonation?.donor_email ?? null,
            donor_address: donorAddress ?? existingDonation?.donor_address ?? null,
            donor_city: donorCity ?? existingDonation?.donor_city ?? null,
            donor_zip: donorZip ?? existingDonation?.donor_zip ?? null,
            donor_country: donorCountry ?? existingDonation?.donor_country ?? null,
            donor_nif: donorNif ?? existingDonation?.donor_nif ?? null,
            method: dbMethod,
            payment_intent_id: paymentReference,
            receipt_required: receiptRequiredMeta ?? existingDonation?.receipt_required ?? false,
            metadata: mergedMetadata,
        })
        .match(matchQuery)
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
            donor_address: donorAddress,
            donor_city: donorCity,
            donor_zip: donorZip,
            donor_country: donorCountry,
            receipt_required: receiptRequiredMeta ?? false,
            metadata: mergedMetadata,
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
        let numero_socio = await ensureUniqueMemberNumber(
            supabaseServer,
            userId,
            membro?.numero_socio,
        );
        let updatedMember = false;
        let lastUpdateError: any = null;

        for (let attempt = 0; attempt < 3; attempt++) {
            const { error: memberUpdateError } = await supabaseServer
                .from('membros')
                .update({
                    estado_quota: 'pago',
                    proxima_quota: formatISODate(nextQuotaDate),
                    data_adesao: membro?.data_adesao || formatISODate(new Date()),
                    is_membro: true,
                    numero_socio,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (!memberUpdateError) {
                updatedMember = true;
                break;
            }

            lastUpdateError = memberUpdateError;
            // Unique conflict on numero_socio -> fetch next and retry.
            if (String((memberUpdateError as any)?.code || '') === '23505') {
                numero_socio = await getNextMemberNumber(supabaseServer);
                continue;
            }

            break;
        }

        if (!updatedMember && lastUpdateError) {
            throw lastUpdateError;
        }

        // --- REFERRAL REWARD GAMIFICATION ---
        // If this is their FIRST successful payment and they used a referral code, trigger the reward RPC.
        if (!wasMember && membro?.referred_by_code) {
            try {
                const { error: rewardError } = await supabaseServer.rpc('reward_inviter', {
                    p_referral_code: membro.referred_by_code,
                    p_new_member_id: userId,
                    p_amount: 2.50
                });
                if (rewardError) {
                    console.error(`Failed to execute reward_inviter for user ${userId} with code ${membro.referred_by_code}:`, rewardError);
                } else {
                    console.log(`Successfully rewarded inviter for code ${membro.referred_by_code} and new member ${userId}`);
                }
            } catch (err) {
                console.error(`Exception executing reward_inviter for user ${userId}:`, err);
            }
        }
        // ------------------------------------

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

    const verifiedAt = new Date().toISOString();
    const paidStatuses = ['verified', 'succeeded', 'paid', 'manual'];

    const { data: booking, error: bookingError } = await supabaseServer
        .from('bookings')
        .select('id, user_id, paid_amount, total_amount, pilgrimage_id, pilgrimage:pilgrimages(deposit_value)')
        .eq('id', bookingId)
        .single();
    if (bookingError || !booking) {
        throw bookingError || new Error('Reserva não encontrada ao confirmar pagamento.');
    }

    const bookingUserId = (booking as any)?.user_id || (metadata as any)?.userId || null;
    if (!bookingUserId) {
        throw new Error('Reserva sem utilizador associado.');
    }

    const { error: paymentUpsertError } = await supabaseServer.from('pilgrimage_payments').upsert({
        booking_id: bookingId,
        user_id: bookingUserId,
        amount: amountPaid,
        payment_intent_id: paymentReference,
        external_reference: externalReference,
        status: 'verified',
        method,
        verified_at: verifiedAt,
        transaction_id: String((metadata as any)?.reduniqTransactionId || paymentReference || ''),
        notes: `Pagamento via ${method}`
    }, { onConflict: 'external_reference' });

    if (paymentUpsertError) {
        throw paymentUpsertError;
    }

    const { data: allPayments, error: paymentsError } = await supabaseServer
        .from('pilgrimage_payments')
        .select('amount, status')
        .eq('booking_id', bookingId);
    if (paymentsError) throw paymentsError;

    const totalPaid = (allPayments || [])
        .filter((p: any) => paidStatuses.includes(String(p?.status || '').toLowerCase()))
        .reduce((sum: number, p: any) => sum + (Number(p?.amount) || 0), 0);

    const depositValue = Number((booking.pilgrimage as any)?.deposit_value || 0);
    const totalAmount = Number(booking.total_amount || 0);
    const isDepositPaid = totalPaid >= (depositValue - 0.01);
    const isFullyPaid = totalAmount > 0 && totalPaid >= (totalAmount - 0.01);

    const bookingUpdates: any = {
        paid_amount: Math.round(totalPaid * 100) / 100,
        updated_at: verifiedAt,
    };
    if (isDepositPaid || isFullyPaid) {
        bookingUpdates.status = 'confirmed';
        bookingUpdates.deposit_confirmed_at = verifiedAt;
    }

    const { error: bookingUpdateError } = await supabaseServer
        .from('bookings')
        .update(bookingUpdates)
        .eq('id', bookingId);
    if (bookingUpdateError) throw bookingUpdateError;

    if ((booking as any)?.pilgrimage_id) {
        await supabaseServer.rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: (booking as any).pilgrimage_id });
    }

    await createAdminNotification('booking', 'Pagamento Peregrinação', `Reserva #${bookingId} - €${amountPaid.toFixed(2)}`, `/admin/peregrinacoes/inscricao/${bookingId}`);
}

/* -------------------------------------------------------------------------- */
/*                                    STORE                                   */
/* -------------------------------------------------------------------------- */
export async function handleStoreSuccess(ctx: PaymentHandlerContext) {
    const { supabaseServer, amountCents, paymentReference, method, metadata, customerDetails } = ctx;
    const orderRef = metadata.orderRef || metadata.order_ref;

    if (!orderRef) return null;

    const result = await processPaidStoreOrder({
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
    return result;
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
