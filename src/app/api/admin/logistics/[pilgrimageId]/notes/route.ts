import { NextResponse } from 'next/server';

import { guardAdmin } from '../../../../../../lib/logistics-crud';
import { supabaseServer } from '../../../../../../lib/supabase';

/**
 * Nota interna de seguimento de cobrança, uma por pessoa.
 *
 *   PUT { personId, kind: 'pilgrim'|'seat', note }
 *
 * Nota vazia apaga a linha. Estas notas nunca são vistas pelo peregrino e não
 * tocam em `bookings.notes`, que pertence ao sistema de inscrições.
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
    const note = String(body?.note ?? '').trim();

    if (!personId) return NextResponse.json({ error: 'Falta a pessoa.' }, { status: 400 });

    const column = kind === 'seat' ? 'seat_id' : 'pilgrim_id';

    if (!note) {
        const { error } = await supabaseServer!
            .from('pilgrimage_collection_notes')
            .delete()
            .eq('pilgrimage_id', pilgrimageId)
            .eq(column, personId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, note: '' });
    }

    const { error } = await supabaseServer!
        .from('pilgrimage_collection_notes')
        .upsert(
            { pilgrimage_id: pilgrimageId, [column]: personId, note },
            { onConflict: column },
        );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, note });
}
