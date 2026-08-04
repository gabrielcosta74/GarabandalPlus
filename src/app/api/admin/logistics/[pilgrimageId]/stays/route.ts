import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../lib/supabase';

/**
 * Estadias de hotel de uma peregrinação.
 *
 *   POST   cria uma estadia
 *   PATCH  actualiza os campos enviados de uma estadia
 *   DELETE apaga uma estadia
 *
 * Só toca em `pilgrimage_hotel_stays`. Não escreve em inscrições, pagamentos
 * nem na peregrinação.
 */
export const dynamic = 'force-dynamic';

/** Lista branca: nada fora daqui chega à base de dados. */
const FIELDS = new Set([
    'hotel', 'city', 'check_in', 'check_out', 'board', 'status',
    'shared_price_per_night', 'single_supplement_per_night',
    'pax_shared', 'pax_single', 'city_tax_per_person_night',
    'free_per_n', 'paid_amount', 'due_date', 'notes', 'display_order',
]);

const STATUSES = new Set(['idea', 'requested', 'prebooked', 'confirmed', 'paid']);

const pick = (body: any) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body || {})) {
        if (!FIELDS.has(key)) continue;
        if (key === 'status' && !STATUSES.has(String(value))) continue;
        out[key] = value === '' ? null : value;
    }
    return out;
};

const guard = async (req: Request) => {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    return null;
};

export async function POST(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
    const denied = await guard(req);
    if (denied) return denied;

    const { pilgrimageId } = await params;
    const body = await req.json().catch(() => ({}));
    const values = pick(body);

    if (!values.check_in || !values.check_out) {
        return NextResponse.json({ error: 'Faltam as datas de entrada e saída.' }, { status: 400 });
    }

    const { data, error } = await supabaseServer!
        .from('pilgrimage_hotel_stays')
        .insert({ ...values, pilgrimage_id: pilgrimageId })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
    const denied = await guard(req);
    if (denied) return denied;

    const { pilgrimageId } = await params;
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'Falta o id da estadia.' }, { status: 400 });

    const values = pick(body);
    if (Object.keys(values).length === 0) {
        return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
    }

    // O filtro por pilgrimage_id impede editar uma estadia de outra peregrinação.
    const { data, error } = await supabaseServer!
        .from('pilgrimage_hotel_stays')
        .update(values)
        .eq('id', id)
        .eq('pilgrimage_id', pilgrimageId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
    const denied = await guard(req);
    if (denied) return denied;

    const { pilgrimageId } = await params;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta o id da estadia.' }, { status: 400 });

    const { error } = await supabaseServer!
        .from('pilgrimage_hotel_stays')
        .delete()
        .eq('id', id)
        .eq('pilgrimage_id', pilgrimageId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}
