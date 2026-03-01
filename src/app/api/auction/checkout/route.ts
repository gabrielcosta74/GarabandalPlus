import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { getAppUrl } from '../../../../lib/config';

/**
 * POST /api/auction/checkout
 * Initiates a Reduniq payment for an auction win.
 * Requires: item_id and Bearer token.
 */
export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    // Authenticate
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = authData.user.id;

    let body: any;
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { item_id, paymentOptionId } = body;
    if (!item_id) {
        return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    // Verify user is the winner and item is awaiting payment
    const { data: item, error: itemError } = await supabaseServer
        .from('auction_items')
        .select('id, title, current_bid, winner_id, status')
        .eq('id', item_id)
        .single();

    if (itemError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.winner_id !== userId) {
        return NextResponse.json({ error: 'Not the winner' }, { status: 403 });
    }

    if (item.status !== 'awaiting_payment') {
        return NextResponse.json({ error: 'Item is not awaiting payment' }, { status: 400 });
    }

    const amountEur = item.current_bid / 100;
    const orderRef = `auc${String(item.id).slice(0, 8)}${Date.now().toString().slice(-6)}`;
    const description = `Leilao ${String(item.title).slice(0, 30)}`;

    // Build URLs
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const requestOrigin = req.headers.get('origin') || (host ? `${proto}://${host}` : '');
    const appOrigin = getAppUrl();
    const origin = requestOrigin || appOrigin || 'http://localhost:3000';

    const successUrl = `${origin}/leilao/${item.id}?payment=success&orderRef=${orderRef}`;
    const cancelUrl = `${origin}/leilao/${item.id}?payment=failed&orderRef=${orderRef}`;
    const notificationUrl = `${origin}/api/webhooks/reduniq`;

    try {
        // Try with action 101 (pre-auth), then 100 (direct)
        let initResult = await reduniqClient.initiatePayment({
            amount: amountEur,
            orderRef,
            returnUrlOk: successUrl,
            returnUrlError: cancelUrl,
            notificationUrl,
            description,
            languageCode: 'por',
            action: 101,
        });

        if (!initResult?.success || !initResult?.url) {
            initResult = await reduniqClient.initiatePayment({
                amount: amountEur,
                orderRef,
                returnUrlOk: successUrl,
                returnUrlError: cancelUrl,
                notificationUrl,
                description,
                languageCode: 'por',
                action: 100,
            });
        }

        if (!initResult?.success || !initResult?.url) {
            console.error('[Auction Reduniq] Init failed:', initResult?.error);
            return NextResponse.json(
                { error: 'Falha ao iniciar pagamento. Tente transferência bancária.' },
                { status: 502 }
            );
        }

        console.log(`[Auction Reduniq] Payment initiated: ${orderRef} for ${amountEur}€`);

        const tokenToSave = initResult.token || initResult.transactionId || orderRef;
        const { error: updateError } = await supabaseServer
            .from('auction_items')
            .update({ payment_intent_id: tokenToSave })
            .eq('id', item_id);

        if (updateError) {
            console.error('[Auction Reduniq] Failed to save payment_intent_id:', updateError);
        }

        return NextResponse.json({
            url: initResult.url,
            orderRef,
        });

    } catch (err: any) {
        console.error('[Auction Reduniq] Error:', err);
        return NextResponse.json(
            { error: 'Erro ao processar pagamento.' },
            { status: 500 }
        );
    }
}
