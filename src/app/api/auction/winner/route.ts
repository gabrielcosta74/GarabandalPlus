import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

/**
 * POST /api/auction/winner
 * Winner submits shipping details and/or receipt.
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
        .select('id, winner_id, status')
        .eq('id', item_id)
        .single();

    if (itemError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.winner_id !== userId) {
        return NextResponse.json({ error: 'You are not the winner of this item.' }, { status: 403 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    // Handle shipping details
    if (body.shipping_name) {
        const shippingData = JSON.stringify({
            name: body.shipping_name,
            address: body.shipping_address,
            city: body.shipping_city,
            postal: body.shipping_postal,
            phone: body.shipping_phone || null,
        });

        // Store in description field temporarily (or a new JSONB column if preferred)
        // For v1, we append to the item record. Admin sees it.
        updates.winner_email = `${authData.user.email} | Morada: ${body.shipping_name}, ${body.shipping_address}, ${body.shipping_postal} ${body.shipping_city}${body.shipping_phone ? ` | Tel: ${body.shipping_phone}` : ''}`;
    }

    // Handle receipt upload
    if (body.receipt_file) {
        const buffer = Buffer.from(body.receipt_file, 'base64');
        const MAX_SIZE = 10 * 1024 * 1024;

        if (buffer.length > MAX_SIZE) {
            return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 10MB).' }, { status: 413 });
        }

        const filePath = `auction-receipts/${userId}/${item_id}/${Date.now()}_${body.receipt_filename || 'receipt'}`;

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

        // Append receipt path to winner_email field (admin can see it)
        const currentWinnerEmail = updates.winner_email || item.winner_id;
        updates.winner_email = `${currentWinnerEmail || authData.user.email} | Comprovativo: ${filePath}`;
    }

    // Apply updates
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
