import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';

const ADMIN_EMAILS = [
    'geral@apostoladodegarabandal.com',
    'gabrielsanticosta@gmail.com',
    'gabrielcosta74@gmail.com',
    ...(process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
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
 * GET /api/admin/auction/[id]/bids
 * Fetch all bids for a specific auction item (admin only).
 */
export async function GET(
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

    // Fetch bids ordered by highest amount first
    const { data, error } = await supabaseServer!
        .from('auction_bids')
        .select(`
            id,
            user_id,
            user_email,
            amount,
            created_at
        `)
        .eq('item_id', id)
        .order('amount', { ascending: false });

    if (error) {
        console.error('[Admin Auction] Fetch bids error:', error);
        return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
    }

    return NextResponse.json({ bids: data || [] });
}
