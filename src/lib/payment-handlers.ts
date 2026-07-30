import { SupabaseClient } from '@supabase/supabase-js';
import {
    sendMembershipNotification,
    sendMemberReceiptEmail,
    sendDonationReceiptEmail,
    sendAuctionPaymentConfirmedEmail,
} from './email'; // Assume these exist and are exported
import { ensureNotificationRecord, markNotificationSent } from './email-notifications';
import { processPaidStoreOrder } from './store-orders';
import { generateMemberDiplomaPdf } from './member-diploma';
import { createAdminNotification } from './admin-notifications';
import { calculateNextQuotaDate } from './membership-logic';
import { getNextMemberNumber } from './membership-db';
import { sendMarketingEmail } from './marketing-email';

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);
const resolveEmailLocale = (value?: any): 'pt' | 'en' => String(value || '').toLowerCase() === 'en' ? 'en' : 'pt';
const resolveLocaleFromNotes = (notes?: string | null): 'pt' | 'en' =>
    /\[locale:en\]/i.test(String(notes || '')) ? 'en' : 'pt';

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

const normalizeMarketingEmail = (value?: string | null) => {
    const email = String(value || '').trim().toLowerCase();
    return email.includes('@') ? email : null;
};

const formatReferralRewardAmount = (value: unknown, locale: 'pt' | 'en') => {
    const amount = Number(value || 2.5);
    const fixed = Number.isFinite(amount) ? amount.toFixed(2) : '2.50';
    return locale === 'en' ? `€${fixed}` : `€${fixed.replace('.', ',')}`;
};

const logReferralRewardEmail = async (
    supabaseServer: SupabaseClient,
    input: {
        toEmail: string;
        templateKey: string;
        result: Awaited<ReturnType<typeof sendMarketingEmail>>;
        reward: any;
    },
) => {
    await supabaseServer.from('marketing_message_logs').insert({
        channel: 'email',
        to_email: input.toEmail,
        provider_message_id: input.result.providerId || null,
        subject: input.result.subject || null,
        template_key: input.templateKey,
        status: input.result.sent ? 'sent' : 'failed',
        error_message: input.result.error || null,
        sent_at: input.result.sent ? new Date().toISOString() : null,
        metadata: {
            source: 'referral_reward',
            reward_id: input.reward.id,
            referral_code: input.reward.referral_code,
            inviter_id: input.reward.inviter_id,
            new_member_id: input.reward.new_member_id,
        },
    });
};

const sendReferralRewardEmails = async (
    supabaseServer: SupabaseClient,
    input: {
        inviter: any;
        invitee: any;
        reward: any;
        locale: 'pt' | 'en';
    },
) => {
    const rewardLabel = formatReferralRewardAmount(input.reward?.amount, input.locale);
    const inviterEmail = normalizeMarketingEmail(input.inviter?.email);
    const inviteeEmail = normalizeMarketingEmail(input.invitee?.email);
    const inviteeName = input.invitee?.nome || (input.locale === 'en' ? 'your friend' : 'a pessoa convidada');
    const inviterName = input.inviter?.nome || (input.locale === 'en' ? 'your inviter' : 'quem convidou você');

    if (inviterEmail) {
        const result = await sendMarketingEmail({
            contact: {
                display_name: input.inviter?.nome || '',
                normalized_email: inviterEmail,
                language: input.locale,
                recommendation: '',
            },
            templateKey: 'referral_reward_inviter',
            context: {
                inviteeName,
                referralCode: input.reward?.referral_code || input.inviter?.referral_code || null,
                storeCredit: rewardLabel,
            },
        });
        await logReferralRewardEmail(supabaseServer, {
            toEmail: inviterEmail,
            templateKey: 'referral_reward_inviter',
            result,
            reward: input.reward,
        });
    }

    if (inviteeEmail) {
        const result = await sendMarketingEmail({
            contact: {
                display_name: input.invitee?.nome || '',
                normalized_email: inviteeEmail,
                language: input.locale,
                recommendation: '',
            },
            templateKey: 'referral_reward_invitee',
            context: {
                inviterName,
                referralCode: input.invitee?.referral_code || null,
                storeCredit: rewardLabel,
            },
        });
        await logReferralRewardEmail(supabaseServer, {
            toEmail: inviteeEmail,
            templateKey: 'referral_reward_invitee',
            result,
            reward: input.reward,
        });
    }
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
    const receiptRequiredMeta = parseBoolMeta(metadata.receiptRequired);
    const taxIdRequestedMeta =
        parseBoolMeta(metadata.taxIdRequested)
        ?? receiptRequiredMeta;
    const donorNif = taxIdRequestedMeta === false
        ? null
        : normalizeMeta(metadata.donorNif);

    const matchQuery = externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference };

    const { data: existingDonation, error: existingDonationError } = await supabaseServer
        .from('donations')
        .select('id, status, metadata, donor_name, donor_email, donor_address, donor_city, donor_zip, donor_country, donor_nif, receipt_required')
        .match(matchQuery)
        .maybeSingle();
    if (existingDonationError) throw existingDonationError;

    const emailLocale = metadata.locale === 'en' || (existingDonation?.metadata as any)?.locale === 'en' ? 'en' : 'pt';
    const accountingV2Already = (existingDonation?.metadata as any)?.accounting_v2 === true;
    const mergedMetadata = {
        ...(existingDonation?.metadata || {}),
        accounting_v2: true,
        provider: method === 'reduniq' ? 'reduniq' : ((existingDonation?.metadata as any)?.provider || 'stripe'),
        locale: emailLocale,
        reduniq_method: reduniqMethodHint || (existingDonation?.metadata as any)?.reduniq_method || null,
        donorAddress: donorAddress ?? (existingDonation?.metadata as any)?.donorAddress ?? null,
        donorCity: donorCity ?? (existingDonation?.metadata as any)?.donorCity ?? null,
        donorZip: donorZip ?? (existingDonation?.metadata as any)?.donorZip ?? null,
        donorCountry: donorCountry ?? (existingDonation?.metadata as any)?.donorCountry ?? null,
        donorNif: taxIdRequestedMeta === false
            ? null
            : donorNif ?? (existingDonation?.metadata as any)?.donorNif ?? null,
        donorName: donorName ?? (existingDonation?.metadata as any)?.donorName ?? null,
        donorEmail: donorEmail ?? (existingDonation?.metadata as any)?.donorEmail ?? null,
        receiptRequired: receiptRequiredMeta ?? (existingDonation?.metadata as any)?.receiptRequired ?? null,
        taxIdRequested:
            taxIdRequestedMeta
            ?? (existingDonation?.metadata as any)?.taxIdRequested
            ?? false,
    };

    const succeededDonation = {
        status: 'succeeded' as const,
        donor_name: donorName ?? existingDonation?.donor_name ?? null,
        donor_email: donorEmail ?? existingDonation?.donor_email ?? null,
        donor_address: donorAddress ?? existingDonation?.donor_address ?? null,
        donor_city: donorCity ?? existingDonation?.donor_city ?? null,
        donor_zip: donorZip ?? existingDonation?.donor_zip ?? null,
        donor_country: donorCountry ?? existingDonation?.donor_country ?? null,
        donor_nif: taxIdRequestedMeta === false
            ? null
            : donorNif ?? existingDonation?.donor_nif ?? null,
        method: dbMethod,
        payment_intent_id: paymentReference,
        receipt_required:
            taxIdRequestedMeta
            ?? receiptRequiredMeta
            ?? existingDonation?.receipt_required
            ?? false,
        metadata: mergedMetadata,
    };

    let donationId = existingDonation?.id || null;
    let transitionedToSucceeded = false;

    if (existingDonation && existingDonation.status !== 'succeeded') {
        // The status predicate makes concurrent/repeated Reduniq callbacks
        // idempotent: only one request can own the transition to succeeded.
        const { data: updated, error: updateError } = await supabaseServer
            .from('donations')
            .update(succeededDonation)
            .match(matchQuery)
            .neq('status', 'succeeded')
            .select('id')
            .maybeSingle();
        if (updateError) throw updateError;
        donationId = updated?.id || donationId;
        transitionedToSucceeded = Boolean(updated?.id);
    } else if (!existingDonation) {
        const { data: inserted, error: insertError } = await supabaseServer
            .from('donations')
            .insert({
                user_id: userId,
                amount_cents: amountCents,
                currency,
                ...succeededDonation,
                external_reference: externalReference,
                description: 'Doação - Associação do Apostolado de Garabandal',
            })
            .select('id')
            .single();
        if (insertError) {
            // A concurrent callback may have inserted the same payment first.
            if (insertError.code !== '23505') throw insertError;
            const { data: concurrentDonation, error: concurrentError } = await supabaseServer
                .from('donations')
                .select('id')
                .match(matchQuery)
                .maybeSingle();
            if (concurrentError || !concurrentDonation) {
                throw concurrentError || insertError;
            }
            donationId = concurrentDonation.id;
        } else {
            donationId = inserted.id;
            transitionedToSucceeded = true;
        }
    }

    // The metadata marker distinguishes rows handled by this idempotent path
    // from legacy callbacks. If the RPC failed after the status transition,
    // a later callback safely retries the atomic accounting operation.
    if (donationId && (transitionedToSucceeded || accountingV2Already)) {
        const { error: raisedError } = await supabaseServer.rpc(
            'record_donation_in_raised_total',
            { p_donation_id: donationId },
        );
        if (raisedError) throw raisedError;
    }

    // Notifications — guarded by ensureNotificationRecord so webhook retries don't duplicate.
    const notifRef = paymentReference || externalReference || '';
    const notif = donorEmail && amountCents > 0
        ? await ensureNotificationRecord(supabaseServer, { type: 'donation_paid', reference: notifRef, userId, email: donorEmail })
        : { shouldSend: false, recordId: null };

    if (notif.shouldSend && donorEmail) {
        await sendDonationReceiptEmail({
            toEmail: donorEmail,
            donorName,
            amount: amountCents / 100,
            currency,
            paymentReference,
            paidAt: ctx.paymentDate?.toISOString() || new Date().toISOString(),
            method,
            locale: emailLocale,
        });
        await markNotificationSent(supabaseServer, notif.recordId);
        // Admin notification shares the same idempotency gate — only fires once per payment.
        await createAdminNotification('donation', 'Nova Doação', `${donorName || 'Anon'} - ${currency} ${(amountCents / 100).toFixed(2)}`, '/admin/doacoes');
    }
}

/* -------------------------------------------------------------------------- */
/*                                 MEMBERSHIP                                 */
/* -------------------------------------------------------------------------- */
export async function handleMembershipSuccess(ctx: PaymentHandlerContext) {
    const { supabaseServer, amountCents, currency, paymentReference, externalReference, method, metadata, customerDetails } = ctx;
    const userId = metadata.userId || null;

    // Update Payment Record
    const membershipPaymentUpdate: Record<string, unknown> = {
        estado: 'pago',
        valor: amountCents / 100,
        payment_intent_id: paymentReference,
    };
    // Preliminary Reduniq rows keep the concrete option selected by the user
    // (card, MB WAY, PIX or Multibanco). A generic webhook method must not erase it.
    if (method !== 'reduniq') {
        membershipPaymentUpdate.metodo_pagamento = method;
    }
    await supabaseServer
        .from('pagamentos_quotas')
        .update(membershipPaymentUpdate)
        .match(externalReference ? { external_reference: externalReference } : { payment_intent_id: paymentReference });

    // Check Notification Status
    let paymentRow: any = null;
    try {
        const { data } = await supabaseServer.from('pagamentos_quotas').select('id, email_notificado_at, notes')
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
        const emailLocale = resolveEmailLocale(metadata.locale) === 'en'
            ? 'en'
            : resolveLocaleFromNotes(paymentRow?.notes);

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
                const { data: existingReferralReward } = await supabaseServer
                    .from('referral_rewards')
                    .select('id')
                    .eq('new_member_id', userId)
                    .maybeSingle();

                const { error: rewardError } = await supabaseServer.rpc('reward_inviter', {
                    p_referral_code: membro.referred_by_code,
                    p_new_member_id: userId,
                    p_amount: 2.50
                });
                if (rewardError) {
                    console.error(`Failed to execute reward_inviter for user ${userId} with code ${membro.referred_by_code}:`, rewardError);
                } else {
                    console.log(`Successfully rewarded inviter for code ${membro.referred_by_code} and new member ${userId}`);
                    if (!existingReferralReward?.id) {
                        const { data: rewardRow } = await supabaseServer
                            .from('referral_rewards')
                            .select('id,referral_code,inviter_id,new_member_id,amount,created_at')
                            .eq('new_member_id', userId)
                            .maybeSingle();

                        if (rewardRow?.id) {
                            const [{ data: inviter }, { data: invitee }] = await Promise.all([
                                supabaseServer
                                    .from('membros')
                                    .select('id,nome,email,referral_code,store_credits')
                                    .eq('id', rewardRow.inviter_id)
                                    .maybeSingle(),
                                supabaseServer
                                    .from('membros')
                                    .select('id,nome,email,referral_code,store_credits')
                                    .eq('id', rewardRow.new_member_id)
                                    .maybeSingle(),
                            ]);

                            await sendReferralRewardEmails(supabaseServer, {
                                inviter,
                                invitee: invitee || membro,
                                reward: rewardRow,
                                locale: emailLocale,
                            });
                        }
                    }
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

            // Send the member-facing receipt. New members receive the diploma attached.
            const shouldAttachDiploma = !membro?.diploma_enviado_at && !!numero_socio;
            if (memberEmail) {
                const attachments = shouldAttachDiploma
                    ? [{
                        filename: 'diploma.pdf',
                        content: Buffer.from(await generateMemberDiplomaPdf({ memberName: membro.nome, memberNumber: Number(numero_socio), issuedAt: new Date().toISOString(), locale: emailLocale })),
                        contentType: 'application/pdf',
                    }]
                    : undefined;

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
                    attachments,
                    hasDiploma: shouldAttachDiploma,
                    locale: emailLocale,
                });

                if (shouldAttachDiploma) {
                    await supabaseServer.from('membros').update({ diploma_enviado_at: new Date().toISOString() }).eq('id', userId);
                }
            }

            // Mark as notified only after all configured sends complete.
            if (paymentRow?.id) await supabaseServer.from('pagamentos_quotas').update({ email_notificado_at: new Date().toISOString() }).eq('id', paymentRow.id);

            // Admin notification is inside shouldNotify so webhook retries don't create duplicates.
            await createAdminNotification('member', wasMember ? 'Renovação' : 'Novo Sócio', `${membro?.nome} - ${amountCents / 100}€`, '/admin/membros');
        }
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

    const existingNotes = typeof (metadata as any)?.existingNotes === 'string'
        ? String((metadata as any).existingNotes).trim()
        : '';
    const confirmedNote = `Pagamento confirmado via ${method}`;
    const notes = existingNotes
        ? (existingNotes.includes(confirmedNote) ? existingNotes : `${existingNotes} | ${confirmedNote}`)
        : confirmedNote;

    const { data: existingPayment } = externalReference
        ? await supabaseServer
            .from('pilgrimage_payments')
            .select('method, processing_fee_amount')
            .eq('external_reference', externalReference)
            .maybeSingle()
        : { data: null };
    const persistedPaymentMethod =
        method === 'reduniq' && String(existingPayment?.method || '').startsWith('reduniq_')
            ? String(existingPayment?.method)
            : method;

    const { error: paymentUpsertError } = await supabaseServer.from('pilgrimage_payments').upsert({
        booking_id: bookingId,
        user_id: bookingUserId,
        amount: amountPaid,
        processing_fee_amount: Number(existingPayment?.processing_fee_amount || 0),
        payment_intent_id: paymentReference,
        external_reference: externalReference,
        status: 'verified',
        method: persistedPaymentMethod,
        verified_at: verifiedAt,
        transaction_id: String((metadata as any)?.reduniqTransactionId || paymentReference || ''),
        notes
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

    await createAdminNotification(
        'booking',
        'Pagamento Peregrinação',
        `Reserva #${bookingId} - €${amountPaid.toFixed(2)}`,
        `/admin/peregrinacoes/inscricao/${bookingId}`,
        `pilgrimage-payment:${externalReference || paymentReference}`,
    );
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
    } else if (type === 'pilgrimage_payment') {
        await supabaseServer.from('pilgrimage_payments').update({ status: 'failed' }).match(matchQuery);
    }
}

/* -------------------------------------------------------------------------- */
/*                                  AUCTIONS                                  */
/* -------------------------------------------------------------------------- */
export async function handleAuctionSuccess(ctx: PaymentHandlerContext) {
    const { supabaseServer, amountCents, paymentReference, method, metadata } = ctx;
    const auctionItemId = metadata.auctionItemId;

    if (!auctionItemId) return null;

    // Get the auction item info
    const { data: item } = await supabaseServer
        .from('auction_items')
        .select('id, title, winner_id')
        .eq('id', auctionItemId)
        .single();

    if (!item) return null;

    // Update the auction item status to paid
    await supabaseServer
        .from('auction_items')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', auctionItemId);

    console.log(`[Auction] Marked as paid in handler: ${auctionItemId}`);

    // Notifications — guarded by ensureNotificationRecord (unique on type+reference)
    // so the webhook and the in-browser confirm don't both send the confirmation
    // email / admin notification for the same payment.
    const notif = await ensureNotificationRecord(supabaseServer, {
        type: 'auction_paid',
        reference: String(auctionItemId),
        userId: item.winner_id || null,
    });

    if (!notif.shouldSend) return;

    // Try to get winner details to send email (membros.id == auth.users.id)
    if (item.winner_id) {
        const { data: membro } = await supabaseServer
            .from('membros')
            .select('nome, email')
            .eq('id', item.winner_id)
            .maybeSingle();

        if (membro?.email) {
            await sendAuctionPaymentConfirmedEmail({
                toEmail: membro.email,
                itemTitle: item.title || 'Artigo de Leilão',
                winnerName: membro.nome,
                winningBid: amountCents,
                paymentMethod: method,
                paymentReference,
                paidAt: new Date().toISOString()
            });
            console.log(`[Auction] Sent payment confirmed email to ${membro.email}`);
        }
    }

    // Create an admin notification
    await createAdminNotification('auction', 'Pagamento Leilão', `Leilão #${auctionItemId} - ${(amountCents / 100).toFixed(2)}€`, `/admin/leilao`);

    await markNotificationSent(supabaseServer, notif.recordId);
}
