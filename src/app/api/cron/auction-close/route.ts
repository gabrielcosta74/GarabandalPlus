import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendAuctionWinnerEmail, sendAuctionAdminNotification } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';

/**
 * GET /api/cron/auction-close
 * Cron job that runs hourly to:
 * 1. Close expired auctions (active → awaiting_payment or ended)
 * 2. Handle payment deadline expiry (awaiting_payment → fallback to 2nd bidder or defaulted)
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET || '';
    if (!secret && process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 500 });
    }
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${secret}` && process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const results = { closed: 0, defaulted: 0, reassigned: 0, errors: [] as string[] };
    const appUrl = getAppUrl() || 'https://apostoladodegarabandal.com';

    try {
        // ============================================
        // STEP 1: Close expired active auctions
        // ============================================
        const now = new Date().toISOString();

        const { data: expiredItems, error: expiredError } = await supabaseServer
            .from('auction_items')
            .select('id, current_bid, current_bidder_id, title, total_bids')
            .eq('status', 'active')
            .lt('ends_at', now);

        if (expiredError) {
            results.errors.push(`Fetch expired: ${expiredError.message}`);
        }

        for (const item of expiredItems || []) {
            if (item.current_bid && item.current_bidder_id) {
                // Has bids → set winner and payment deadline (48h)
                const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

                // Get winner email
                const { data: winnerUser } = await supabaseServer.auth.admin.getUserById(item.current_bidder_id);
                const winnerEmail = winnerUser?.user?.email || null;
                const winnerName = winnerUser?.user?.user_metadata?.name || winnerUser?.user?.user_metadata?.full_name || null;

                const { error: updateError } = await supabaseServer
                    .from('auction_items')
                    .update({
                        status: 'awaiting_payment',
                        winner_id: item.current_bidder_id,
                        winner_email: winnerEmail,
                        payment_deadline: deadline,
                        updated_at: now
                    })
                    .eq('id', item.id);

                if (updateError) {
                    results.errors.push(`Close ${item.id}: ${updateError.message}`);
                } else {
                    results.closed++;
                    console.log(`[Auction Cron] Closed auction "${item.title}" → winner: ${winnerEmail}`);

                    // Send winner email
                    if (winnerEmail) {
                        sendAuctionWinnerEmail({
                            email: winnerEmail,
                            winnerName,
                            itemTitle: item.title || 'Peça de Leilão',
                            winningBid: item.current_bid,
                            paymentDeadlineHours: 48,
                            itemUrl: `${appUrl}/leilao/${item.id}`,
                        }).catch(err => console.error('[Auction Cron] Winner email error:', err));
                    }

                    // Send admin notification
                    sendAuctionAdminNotification({
                        itemTitle: item.title || 'Peça de Leilão',
                        winnerEmail: winnerEmail || 'Desconhecido',
                        winningBid: item.current_bid / 100,
                        totalBids: item.total_bids || 0,
                    }).catch(err => console.error('[Auction Cron] Admin email error:', err));
                }
            } else {
                // No bids → just end it
                await supabaseServer
                    .from('auction_items')
                    .update({ status: 'ended', updated_at: now })
                    .eq('id', item.id);

                results.closed++;
                console.log(`[Auction Cron] Closed auction "${item.title}" → no bids`);
            }
        }

        // ============================================
        // STEP 2: Handle expired payment deadlines
        // ============================================
        const { data: unpaidItems, error: unpaidError } = await supabaseServer
            .from('auction_items')
            .select('id, title, winner_id, winner_email, total_bids')
            .eq('status', 'awaiting_payment')
            .lt('payment_deadline', now);

        if (unpaidError) {
            results.errors.push(`Fetch unpaid: ${unpaidError.message}`);
        }

        for (const item of unpaidItems || []) {
            // Ban the non-paying user (membros.id == auth.users.id)
            if (item.winner_id) {
                await supabaseServer
                    .from('membros')
                    .update({ banned_from_auction: true })
                    .eq('id', item.winner_id);

                console.log(`[Auction Cron] Banned user ${item.winner_email} from auctions`);
            }

            // Find the next highest bidder, skipping any bidder already banned from auctions
            // (covers chain-defaults: 1st winner ban → 2nd winner ban → must skip both).
            const { data: bannedRows } = await supabaseServer
                .from('membros')
                .select('id')
                .eq('banned_from_auction', true);
            const bannedIds = new Set((bannedRows || []).map(r => r.id));
            if (item.winner_id) bannedIds.add(item.winner_id);

            const { data: allBids } = await supabaseServer
                .from('auction_bids')
                .select('user_id, user_email, amount')
                .eq('item_id', item.id)
                .order('amount', { ascending: false });

            const nextBid = (allBids || []).find(b => b.user_id && !bannedIds.has(b.user_id)) || null;

            if (nextBid) {
                // Reassign to 2nd highest bidder
                const newDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

                await supabaseServer
                    .from('auction_items')
                    .update({
                        current_bid: nextBid.amount,
                        current_bidder_id: nextBid.user_id,
                        winner_id: nextBid.user_id,
                        winner_email: nextBid.user_email,
                        payment_deadline: newDeadline,
                        updated_at: now
                    })
                    .eq('id', item.id);

                results.reassigned++;
                console.log(`[Auction Cron] Reassigned "${item.title}" to ${nextBid.user_email} (${(nextBid.amount / 100).toFixed(0)}€)`);

                // Send winner email to the new winner
                if (nextBid.user_email) {
                    sendAuctionWinnerEmail({
                        email: nextBid.user_email,
                        itemTitle: item.title || 'Peça de Leilão',
                        winningBid: nextBid.amount,
                        paymentDeadlineHours: 48,
                        itemUrl: `${appUrl}/leilao/${item.id}`,
                    }).catch(err => console.error('[Auction Cron] Reassign email error:', err));
                }
            } else {
                // No other bidders → mark as defaulted
                await supabaseServer
                    .from('auction_items')
                    .update({
                        status: 'defaulted',
                        updated_at: now
                    })
                    .eq('id', item.id);

                results.defaulted++;
                console.log(`[Auction Cron] Defaulted "${item.title}" — no fallback bidders`);
            }
        }
    } catch (err: any) {
        results.errors.push(err.message || 'Unknown error');
    }

    console.log('[Auction Cron] Results:', JSON.stringify(results));
    return NextResponse.json({ success: true, ...results });
}

