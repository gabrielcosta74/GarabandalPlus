import { NextResponse } from 'next/server';

import { guardAdmin } from '../../../../../../../lib/logistics-crud';
import { supabaseServer } from '../../../../../../../lib/supabase';

/**
 * Mover uma pessoa entre quartos.
 *
 *   PUT  { personId, kind: 'pilgrim'|'seat', roomId }  → põe no quarto
 *   PUT  { personId, kind, roomId: null }              → tira do quarto
 *
 * Uma pessoa só pode estar num quarto: os índices únicos garantem-no na base de
 * dados, e aqui apagamos a colocação anterior antes de criar a nova.
 */
export const dynamic = 'force-dynamic';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> },
) {
    const denied = await guardAdmin(req);
    if (denied) return denied;

    const { pilgrimageId } = await params;
    const body = await req.json().catch(() => ({}));
    const personId = String(body?.personId || '');
    const kind = body?.kind === 'seat' ? 'seat' : 'pilgrim';
    const roomId = body?.roomId ? String(body.roomId) : null;

    if (!personId) return NextResponse.json({ error: 'Falta a pessoa.' }, { status: 400 });

    const column = kind === 'seat' ? 'seat_id' : 'pilgrim_id';

    // Tirar da colocação atual, seja ela qual for.
    const { error: delError } = await supabaseServer!
        .from('pilgrimage_room_members')
        .delete()
        .eq(column, personId);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });

    if (!roomId) return NextResponse.json({ ok: true, roomId: null });

    // O quarto tem de ser desta peregrinação — impede mover para outra viagem.
    const { data: room, error: roomError } = await supabaseServer!
        .from('pilgrimage_rooms')
        .select('id')
        .eq('id', roomId)
        .eq('pilgrimage_id', pilgrimageId)
        .maybeSingle();
    if (roomError) return NextResponse.json({ error: roomError.message }, { status: 400 });
    if (!room) return NextResponse.json({ error: 'Quarto não encontrado nesta peregrinação.' }, { status: 404 });

    const { count } = await supabaseServer!
        .from('pilgrimage_room_members')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);

    const { error } = await supabaseServer!
        .from('pilgrimage_room_members')
        .insert({ room_id: roomId, [column]: personId, position: count || 0 });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, roomId });
}
