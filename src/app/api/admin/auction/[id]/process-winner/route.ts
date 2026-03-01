import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { sendAuctionWinnerEmail } from '../../../../../../lib/email';

const ADMIN_EMAILS = [
    'geral@apostoladodegarabandal.com',
    'gabrielcosta2908@gmail.com'
];

async function verifyAdmin(req: Request): Promise<{ isAdmin: boolean; error?: string }> {
    if (!supabaseServer) return { isAdmin: false, error: 'Server config error' };

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { isAdmin: false, error: 'Unauthorized' };

    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error || !data?.user) return { isAdmin: false, error: 'Invalid session' };

    const email = (data.user.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) return { isAdmin: false, error: 'Forbidden' };

    return { isAdmin: true };
}

/**
 * POST /api/admin/auction/[id]/process-winner
 * Manually close an active auction, find the winner, set deadline, and send email.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAdmin(req);
    if (!auth.isAdmin) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // 1. Get the auction item
    const { data: item, error: itemError } = await supabaseServer!
        .from('auction_items')
        .select('*')
        .eq('id', id)
        .single();

    if (itemError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.status !== 'active') {
        return NextResponse.json({ error: 'Só é possível processar leilões ativos.' }, { status: 400 });
    }

    // 2. See if there are bids
    if (!item.current_bidder_id) {
        // No bids at all -> just mark as ended
        await supabaseServer!
            .from('auction_items')
            .update({ status: 'ended' })
            .eq('id', item.id);

        return NextResponse.json({ success: true, message: 'Leilão terminado sem lances.' });
    }

    // 3. There is a winner. Fetch winner email from their highest bid
    const { data: winnerBid } = await supabaseServer!
        .from('auction_bids')
        .select('user_email')
        .eq('item_id', item.id)
        .eq('user_id', item.current_bidder_id)
        .order('amount', { ascending: false })
        .limit(1)
        .single();

    const winnerEmail = winnerBid?.user_email || 'unknown';

    // Fetch the winner name from the members table if possible
    const { data: memberData } = await supabaseServer!
        .from('membros')
        .select('nome')
        .eq('user_id', item.current_bidder_id)
        .single();

    const winnerName = memberData?.nome || null;

    // 4. Update the item
    // Add 48 hours for deadline
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);

    const { error: updateError } = await supabaseServer!
        .from('auction_items')
        .update({
            status: 'awaiting_payment',
            winner_id: item.current_bidder_id,
            winner_email: winnerEmail,
            payment_deadline: deadline.toISOString()
        })
        .eq('id', item.id);

    if (updateError) {
        console.error('[Admin Process Winner] DB Update error:', updateError);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    // 5. Send Email (fire and forget)
    sendAuctionWinnerEmail({
        email: winnerEmail,
        winnerName: winnerName,
        itemTitle: item.title,
        winningBid: item.current_bid || 0,
        paymentDeadlineHours: 48,
        itemUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://apostoladodegarabandal.com'}/leilao/${item.id}`
    }).catch(e => console.error('[Admin Process Winner] Email error:', e));

    return NextResponse.json({ success: true, winnerEmail });
}
