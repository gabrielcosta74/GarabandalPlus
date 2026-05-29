import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

/**
 * POST /api/auction/winner
 * Winner submits shipping details and/or receipt URL.
 * Body: { item_id, shipping_name?, shipping_address?, shipping_city?,
 *         shipping_postal?, shipping_phone?, receipt_url?, receipt_file? (base64) }
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
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { item_id } = body;
    if (!item_id) {
        return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    // Verify this user is the winner
    const { data: item, error: itemError } = await supabaseServer
        .from('auction_items')
        .select('id, winner_id, status, shipping_info')
        .eq('id', item_id)
        .single();

    if (itemError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.winner_id !== userId) {
        return NextResponse.json({ error: 'You are not the winner of this item.' }, { status: 403 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    // Shipping info → store in dedicated jsonb column (merge with existing)
    if (body.shipping_name && body.shipping_address && body.shipping_city && body.shipping_postal) {
        updates.shipping_info = {
            ...(item.shipping_info || {}),
            name: String(body.shipping_name).slice(0, 200),
            address: String(body.shipping_address).slice(0, 300),
            city: String(body.shipping_city).slice(0, 100),
            postal: String(body.shipping_postal).slice(0, 20),
            phone: body.shipping_phone ? String(body.shipping_phone).slice(0, 30) : null,
            submitted_at: new Date().toISOString(),
        };
    }

    // Receipt: client may either upload first and send the URL, or send base64 file
    if (body.receipt_url && typeof body.receipt_url === 'string') {
        updates.receipt_url = body.receipt_url.slice(0, 1024);
    } else if (body.receipt_file) {
        const buffer = Buffer.from(body.receipt_file, 'base64');
        const MAX_SIZE = 10 * 1024 * 1024;

        if (buffer.length > MAX_SIZE) {
            return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 10MB).' }, { status: 413 });
        }

        const safeName = String(body.receipt_filename || 'receipt').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const filePath = `auction-receipts/${userId}/${item_id}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabaseServer.storage
            .from('receipts')
            .upload(filePath, buffer, {
                contentType: body.receipt_type || 'application/octet-stream',
                upsert: true
            });

        if (uploadError) {
            console.error('[Auction Winner] Upload error:', uploadError);
            return NextResponse.json({ error: 'Erro ao enviar ficheiro.' }, { status: 500 });
        }

        updates.receipt_url = filePath;
    }

    if (Object.keys(updates).length > 1) {
        const { error: updateError } = await supabaseServer
            .from('auction_items')
            .update(updates)
            .eq('id', item_id);

        if (updateError) {
            console.error('[Auction Winner] Update error:', updateError);
            return NextResponse.json({ error: 'Erro ao guardar dados.' }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true });
}
