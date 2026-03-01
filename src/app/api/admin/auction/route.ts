import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

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
 * GET /api/admin/auction
 * List all auction items (all statuses) for admin.
 */
export async function GET(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.isAdmin) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const { data, error } = await supabaseServer!
        .from('auction_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
}

/**
 * POST /api/admin/auction
 * Create a new auction item.
 * Body: { title, description, images, artisan_name, starting_price, min_increment, ends_at }
 */
export async function POST(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.isAdmin) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { title, description, images, artisan_name, starting_price, min_increment, ends_at } = body;

    if (!title || !starting_price || !ends_at) {
        return NextResponse.json({ error: 'title, starting_price e ends_at são obrigatórios.' }, { status: 400 });
    }

    const { data, error } = await supabaseServer!
        .from('auction_items')
        .insert({
            title,
            description: description || null,
            images: images || [],
            artisan_name: artisan_name || 'Artesã do Apostolado',
            starting_price,
            min_increment: min_increment || 100,
            ends_at,
            status: 'draft'
        })
        .select()
        .single();

    if (error) {
        console.error('[Admin Auction] Create error:', error);
        return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
}

/**
 * PUT /api/admin/auction
 * Update an auction item.
 * Body: { id, ...fields }
 */
export async function PUT(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.isAdmin) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { id, ...updates } = body;
    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Ensure updated_at is set
    updates.updated_at = new Date().toISOString();

    // If activating, validate required fields
    if (updates.status === 'active') {
        const { data: existing } = await supabaseServer!
            .from('auction_items')
            .select('title, starting_price, ends_at, images')
            .eq('id', id)
            .single();

        if (!existing?.title || !existing?.starting_price || !existing?.ends_at) {
            return NextResponse.json({
                error: 'O item precisa de título, preço mínimo e data de fecho para ser ativado.'
            }, { status: 400 });
        }
    }

    const { data, error } = await supabaseServer!
        .from('auction_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Admin Auction] Update error:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ item: data });
}

/**
 * DELETE /api/admin/auction
 * Delete an auction item (only drafts).
 * Body: { id }
 */
export async function DELETE(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.isAdmin) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { id } = body;
    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabaseServer!
        .from('auction_items')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Admin Auction] Delete error:', error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
