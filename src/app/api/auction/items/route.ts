import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

/**
 * GET /api/auction/items
 * Lists auction items that are visible to the public (not drafts).
 */
export async function GET() {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data, error } = await supabaseServer
        .from('auction_items')
        .select('id, title, description, images, artisan_name, starting_price, min_increment, current_bid, total_bids, ends_at, status, created_at')
        .not('status', 'eq', 'draft')
        .order('ends_at', { ascending: true });

    if (error) {
        console.error('[Auction] Items fetch error:', error);
        return NextResponse.json({ error: 'Failed to load auction items' }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
}
