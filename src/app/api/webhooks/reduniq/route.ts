import { NextResponse } from 'next/server';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { supabaseServer } from '../../../../lib/supabase';
import {
    handleDonationSuccess,
    handleMembershipSuccess,
    handlePilgrimageSuccess,
    handleStoreSuccess,
    handleAuctionSuccess,
    handlePaymentFailedOrCanceled,
    PaymentHandlerContext
} from '../../../../lib/payment-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('Reduniq Webhook Received:', body);

        // Helper function to find token from DB if webhook omitted it
        async function findTokenByOrderRef(orderRef: string) {
            if (!supabaseServer) return null;
            const { data: d } = await supabaseServer.from('donations').select('payment_intent_id').eq('external_reference', orderRef).maybeSingle();
            if (d?.payment_intent_id) return String(d.payment_intent_id);
            const { data: q } = await supabaseServer.from('pagamentos_quotas').select('payment_intent_id').eq('external_reference', orderRef).maybeSingle();
            if (q?.payment_intent_id) return String(q.payment_intent_id);
            const { data: s } = await supabaseServer.from('store_orders').select('payment_reference').eq('order_ref', orderRef).maybeSingle();
            if (s?.payment_reference) return String(s.payment_reference);
            const { data: p } = await supabaseServer.from('pilgrimage_payments').select('payment_intent_id').eq('external_reference', orderRef).maybeSingle();
            if (p?.payment_intent_id) return String(p.payment_intent_id);
            const { data: a } = await supabaseServer.from('auction_items').select('payment_intent_id').or(`payment_intent_id.eq.${orderRef},id.eq.${orderRef.replace('auc', '').substring(0, Math.max(0, orderRef.length - 6))}`).maybeSingle();
            if (a?.payment_intent_id) return String(a.payment_intent_id);
            return null;
        }

        // Payload usually contains: token (preferred), id, status, etc.
        // We MUST verify with Reduniq API to be secure.
        let token =
            body.token ||
            body?.payment?.token ||
            body?.transaction?.token;

        const fallbackRef = body?.order_id || body?.id || body?.reference;

        if (!token && fallbackRef) {
            token = await findTokenByOrderRef(fallbackRef);
        }

        if (!token) {
            token = fallbackRef;
        }

        if (!token) {
            return NextResponse.json({ message: 'Missing token' }, { status: 400 });
        }

        // Secure Verification: Query Reduniq API for the actual status using token
        const manualCheck = await reduniqClient.getOrderStatus(token);

        if (!manualCheck.success) {
            console.error(`Unable to verify Reduniq payment token ${token}`);
            return NextResponse.json({ message: 'Verification failed' }, { status: 500 });
        }

        const verifiedStatus = manualCheck.status;
        const isSuccess = verifiedStatus === 'success';
        const isFailed = verifiedStatus === 'failed';

        // We need to retrieve metadata to know what type it is (Donation, Store, etc.)
        // Strategy: Look up the referenced internal ID in our DB?
        // Or, hopefully Reduniq passed back our "order_id" (externalRef) as a reference field.
        // If the webhook identifier is a Reduniq ID/token, we need to find our internal record using orderRef/privateData.

        // Let's assume we store the "Reduniq ID" (transactionId) in our tables when we initiate? 
        // Problem: logic initiated -> we get URL -> user pays -> webhook.
        // We might not have the Reduniq ID stored yet if we only redirect.
        // BUT we sent our 'orderRef' as 'order.ref' and also in privateData.
        // We will try to pull it from getResult (privateData.orderRef).

        // Assumption: Reduniq returns the 'order_id' we sent them in a field like 'merchant_order_id' or we use their ID if we got it at init.
        // Based on `initiatePayment`, we sent `order_id: params.orderRef`.
        // Let's try to find the record in our DBs to determine type and hydrate context.

        const referenceToMatch = manualCheck.orderRef || body.order_id || body.id || null;

        if (!supabaseServer) return NextResponse.json({ message: 'Db unavailable' }, { status: 500 });

        // 1. Try Store Orders
        const { data: storeOrder } = referenceToMatch
            ? await supabaseServer.from('store_orders').select('*').eq('order_ref', referenceToMatch).maybeSingle()
            : { data: null };
        if (storeOrder) {
            if (isSuccess) {
                const context: PaymentHandlerContext = {
                    supabaseServer,
                    amountCents: Math.round((storeOrder.total_amount || 0) * 100),
                    currency: storeOrder.currency || 'EUR',
                    paymentReference: token,
                    externalReference: storeOrder.order_ref,
                    method: 'reduniq',
                    metadata: { type: 'store', orderRef: storeOrder.order_ref, reduniqTransactionId: manualCheck.transactionId },
                    customerDetails: {
                        name: storeOrder.buyer_name,
                        email: storeOrder.buyer_email
                    }
                };
                await handleStoreSuccess(context);
            } else if (isFailed) {
                const context: PaymentHandlerContext = {
                    supabaseServer,
                    amountCents: Math.round((storeOrder.total_amount || 0) * 100),
                    currency: storeOrder.currency || 'EUR',
                    paymentReference: token,
                    externalReference: storeOrder.order_ref,
                    method: 'reduniq',
                    metadata: { type: 'store', orderRef: storeOrder.order_ref, reduniqTransactionId: manualCheck.transactionId },
                    customerDetails: {
                        name: storeOrder.buyer_name,
                        email: storeOrder.buyer_email
                    }
                };
                await handlePaymentFailedOrCanceled(context, 'failed');
            }
            return NextResponse.json({ received: true });
        }

        // 2. Try Donations (external_reference)
        const { data: donation } = referenceToMatch
            ? await supabaseServer.from('donations').select('*').eq('external_reference', referenceToMatch).maybeSingle()
            : await supabaseServer.from('donations').select('*').eq('payment_intent_id', token).maybeSingle();
        if (donation) {
            if (isSuccess) {
                const context: PaymentHandlerContext = {
                    supabaseServer,
                    amountCents: donation.amount_cents,
                    currency: donation.currency,
                    paymentReference: token,
                    externalReference: donation.external_reference,
                    method: 'reduniq',
                    metadata: {
                        type: 'donation',
                        userId: donation.user_id,
                        donorName: donation.donor_name,
                        donorEmail: donation.donor_email,
                        donorNif: donation.donor_nif,
                        donorAddress: donation.donor_address,
                        donorCity: donation.donor_city,
                        donorZip: donation.donor_zip,
                        donorCountry: donation.donor_country,
                        receiptRequired: donation.receipt_required,
                        locale: (donation.metadata as any)?.locale || 'pt',
                        reduniq_method: (donation.metadata as any)?.reduniq_method || null,
                        reduniqTransactionId: manualCheck.transactionId
                        // ... other meta if needed
                    }
                };
                await handleDonationSuccess(context);
            } else if (isFailed) {
                const context: PaymentHandlerContext = {
                    supabaseServer,
                    amountCents: donation.amount_cents,
                    currency: donation.currency,
                    paymentReference: token,
                    externalReference: donation.external_reference,
                    method: 'reduniq',
                    metadata: { type: 'donation', userId: donation.user_id, reduniqTransactionId: manualCheck.transactionId }
                };
                await handlePaymentFailedOrCanceled(context, 'failed');
            }
            return NextResponse.json({ received: true });
        }

        // 3. Try Membership (pagamentos_quotas external_reference)
        const { data: quota } = referenceToMatch
            ? await supabaseServer.from('pagamentos_quotas').select('*').eq('external_reference', referenceToMatch).maybeSingle()
            : await supabaseServer.from('pagamentos_quotas').select('*').eq('payment_intent_id', token).maybeSingle();
        if (quota) {
            if (isSuccess) {
                const context: PaymentHandlerContext = {
                    supabaseServer,
                    amountCents: Math.round((quota.valor || 0) * 100),
                    currency: 'EUR',
                    paymentReference: token,
                    externalReference: quota.external_reference,
                    method: 'reduniq',
                    metadata: {
                        type: 'membership',
                        userId: quota.user_id,
                        locale: /\[locale:en\]/i.test(String(quota.notes || '')) ? 'en' : 'pt',
                    }
                };
                await handleMembershipSuccess(context);
            } else if (isFailed) {
                const context: PaymentHandlerContext = {
                    supabaseServer,
                    amountCents: Math.round((quota.valor || 0) * 100),
                    currency: 'EUR',
                    paymentReference: token,
                    externalReference: quota.external_reference,
                    method: 'reduniq',
                    metadata: { type: 'membership', userId: quota.user_id, reduniqTransactionId: manualCheck.transactionId }
                };
                await handlePaymentFailedOrCanceled(context, 'failed');
            }
            return NextResponse.json({ received: true });
        }

        // 4. Try Pilgrimages
        const { data: pilgrimagePayment } = referenceToMatch
            ? await supabaseServer.from('pilgrimage_payments').select('*').eq('external_reference', referenceToMatch).maybeSingle()
            : await supabaseServer.from('pilgrimage_payments').select('*').eq('payment_intent_id', token).maybeSingle();
        if (pilgrimagePayment) {
            const context: PaymentHandlerContext = {
                supabaseServer,
                amountCents: Math.round((pilgrimagePayment.amount || 0) * 100),
                currency: 'EUR',
                paymentReference: token,
                externalReference: pilgrimagePayment.external_reference,
                method: 'reduniq',
                metadata: {
                    type: 'pilgrimage_payment',
                    booking_id: pilgrimagePayment.booking_id,
                    reduniqTransactionId: manualCheck.transactionId,
                    existingNotes: pilgrimagePayment.notes || null,
                }
            };

            if (isSuccess) {
                await handlePilgrimageSuccess(context);
            } else if (isFailed) {
                await handlePaymentFailedOrCanceled(context, 'failed');
            }
            return NextResponse.json({ received: true });
        }

        // 5. Try Auctions
        let auctionItemQuery = supabaseServer.from('auction_items').select('*');
        if (referenceToMatch) {
            auctionItemQuery = auctionItemQuery.or(`payment_intent_id.eq.${referenceToMatch},id.eq.${referenceToMatch.replace('auc', '').substring(0, referenceToMatch.length - 6)}`);
        } else {
            auctionItemQuery = auctionItemQuery.eq('payment_intent_id', token);
        }
        const { data: auctionItem } = await auctionItemQuery.maybeSingle();

        if (auctionItem) {
            // current_bid / starting_price are already stored in cents.
            const context: PaymentHandlerContext = {
                supabaseServer,
                amountCents: auctionItem.current_bid || auctionItem.starting_price || 0,
                currency: 'EUR',
                paymentReference: token,
                externalReference: auctionItem.id,
                method: 'reduniq',
                metadata: {
                    type: 'auction',
                    auctionItemId: auctionItem.id,
                    reduniqTransactionId: manualCheck.transactionId
                }
            };

            if (isSuccess) {
                await handleAuctionSuccess(context);
                console.log(`[Reduniq Webhook] Leilão marcado como pago: ${auctionItem.id}`);
            } else if (isFailed) {
                // Declined payment keeps the item in awaiting_payment so the winner
                // can retry within the 48h window. The cron defaults it after the deadline.
                console.log(`[Reduniq Webhook] Pagamento de leilão falhou (mantém awaiting_payment p/ retry): ${auctionItem.id}`);
            }
            return NextResponse.json({ received: true });
        }

        console.warn('Reduniq Webhook: Reference not found in DB', referenceToMatch || '(none)');

        return NextResponse.json({ received: true, status: 'ignored_unknown_ref' });

    } catch (err: any) {
        console.error('Reduniq Webhook Error:', err);
        return NextResponse.json({ message: 'Internal Error', error: err.message }, { status: 500 });
    }
}
