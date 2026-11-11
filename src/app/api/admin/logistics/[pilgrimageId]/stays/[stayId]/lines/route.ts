import { NextResponse } from 'next/server';

import { supabaseServer } from '../../../../../../../../lib/supabase';
import { guardStay, missingTableMessage, numberOf } from '../../../../../../../../lib/logistics/route-guard';

/**
 * Linhas da proforma de um hotel (quartos, suplementos, descontos, taxas).
 *
 *   POST   cria uma linha (ou várias: { lines: [...] })
 *   PATCH  altera os campos enviados de uma linha
 *   DELETE apaga uma linha (?lineId=)
 *
 * Só escreve em `pilgrimage_hotel_lines`.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pilgrimageId: string; stayId: string }> };

const KINDS = new Set(['room', 'supplement', 'discount', 'tax', 'other']);

function pick(body: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    if ('kind' in body && KINDS.has(String(body.kind))) out.kind = body.kind;
    if ('label' in body) out.label = String(body.label ?? '').slice(0, 160);
    for (const [key, column] of [['qty', 'qty'], ['unitPrice', 'unit_price']] as const) {
        if (key in body) {
            const value = numberOf(body[key]);
            if (value !== null) out[column] = Math.round(value * 100) / 100;
        }
    }
    if ('nights' in body) {
        const value = numberOf(body.nights);
        if (value !== null && value >= 0) out.nights = Math.round(value);
    }
    if ('payOnSite' in body) out.pay_on_site = !!body.payOnSite;
    if ('notes' in body) out.notes = body.notes ? String(body.notes).slice(0, 500) : null;
    if ('order' in body) {
        const value = numberOf(body.order);
        if (value !== null) out.display_order = Math.round(value);
    }
    return out;
}

export async function POST(req: Request, { params }: Params) {
    const { pilgrimageId, stayId } = await params;
    const denied = await guardStay(req, pilgrimageId, stayId);
    if (denied) return denied;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const items = Array.isArray(body.lines) ? body.lines as Record<string, unknown>[] : [body];
    const rows = items.slice(0, 40).map(item => ({ ...pick(item), stay_id: stayId }));
    const { data, error } = await supabaseServer!.from('pilgrimage_hotel_lines').insert(rows).select();
    if (error) return NextResponse.json({ error: missingTableMessage(error.message) }, { status: 400 });
    return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: Params) {
    const { pilgrimageId, stayId } = await params;
    const denied = await guardStay(req, pilgrimageId, stayId);
    if (denied) return denied;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const id = String(body.id || '');
    const values = pick(body);
    if (!id || !Object.keys(values).length) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    const { data, error } = await supabaseServer!.from('pilgrimage_hotel_lines')
        .update(values).eq('id', id).eq('stay_id', stayId).select().single();
    if (error) return NextResponse.json({ error: missingTableMessage(error.message) }, { status: 400 });
    return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: Params) {
    const { pilgrimageId, stayId } = await params;
    const denied = await guardStay(req, pilgrimageId, stayId);
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get('lineId');
    if (!id) return NextResponse.json({ error: 'Falta a linha.' }, { status: 400 });
    const { error } = await supabaseServer!.from('pilgrimage_hotel_lines').delete().eq('id', id).eq('stay_id', stayId);
    if (error) return NextResponse.json({ error: missingTableMessage(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true });
}
