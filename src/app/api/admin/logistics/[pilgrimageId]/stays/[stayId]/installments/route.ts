import { NextResponse } from 'next/server';

import { supabaseServer } from '../../../../../../../../lib/supabase';
import { guardStay, isIsoDate, missingTableMessage, numberOf } from '../../../../../../../../lib/logistics/route-guard';
import { splitInstallments } from '../../../../../../../../lib/logistics/hotel-rules';

/**
 * Plano de pagamentos de um hotel. As prestações só dizem quanto e quando;
 * o que está pago vem do banco, pelo acordo da Contabilidade.
 *
 *   POST   cria uma prestação; { items: [...] } cria várias (copiadas da proforma);
 *          { split: { total, dates: [d1, d2, d3] } } cria 30/50/20
 *   PATCH  altera os campos enviados de uma prestação
 *   DELETE apaga uma prestação (?installmentId=)
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pilgrimageId: string; stayId: string }> };

function pick(body: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    if ('label' in body) out.label = String(body.label ?? '').slice(0, 80);
    if ('dueDate' in body && isIsoDate(body.dueDate)) out.due_date = body.dueDate;
    if ('amount' in body) {
        const value = numberOf(body.amount);
        if (value !== null && value >= 0) out.amount = Math.round(value * 100) / 100;
    }
    if ('notes' in body) out.notes = body.notes ? String(body.notes).slice(0, 500) : null;
    return out;
}

const LABELS = ['1.º sinal', '2.º sinal', 'Saldo'];

export async function POST(req: Request, { params }: Params) {
    const { pilgrimageId, stayId } = await params;
    const denied = await guardStay(req, pilgrimageId, stayId);
    if (denied) return denied;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    let rows: Record<string, unknown>[];
    const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : null;
    const split = body.split as { total?: unknown; dates?: unknown[]; shares?: unknown[] } | undefined;
    if (items) {
        rows = items.slice(0, 12).map((item, index) => ({ ...pick(item), stay_id: stayId, display_order: index }));
        if (!rows.length || rows.some(row => !row.due_date || row.amount === undefined)) {
            return NextResponse.json({ error: 'Cada prestação precisa de data e valor.' }, { status: 400 });
        }
    } else if (split) {
        const total = numberOf(split.total);
        const dates = Array.isArray(split.dates) ? split.dates : [];
        const shares = Array.isArray(split.shares) && split.shares.length ? split.shares.map(Number) : [30, 50, 20];
        if (!total || total <= 0) return NextResponse.json({ error: 'Falta o total para dividir.' }, { status: 400 });
        if (dates.length !== shares.length || !dates.every(isIsoDate)) {
            return NextResponse.json({ error: 'Indique uma data por prestação.' }, { status: 400 });
        }
        if (shares.some(share => !Number.isFinite(share) || share <= 0) || Math.round(shares.reduce((a, b) => a + b, 0)) !== 100) {
            return NextResponse.json({ error: 'As percentagens têm de somar 100.' }, { status: 400 });
        }
        const amounts = splitInstallments(total, shares);
        rows = amounts.map((amount, index) => ({
            stay_id: stayId, amount, due_date: dates[index], display_order: index,
            label: shares.length === 3 ? LABELS[index] : `${index + 1}.ª prestação`,
        }));
    } else {
        const values = pick(body);
        if (!values.due_date || values.amount === undefined) {
            return NextResponse.json({ error: 'Indique o valor e a data da prestação.' }, { status: 400 });
        }
        rows = [{ ...values, stay_id: stayId }];
    }

    const { data, error } = await supabaseServer!.from('pilgrimage_hotel_installments').insert(rows).select();
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
    const { data, error } = await supabaseServer!.from('pilgrimage_hotel_installments')
        .update(values).eq('id', id).eq('stay_id', stayId).select().single();
    if (error) return NextResponse.json({ error: missingTableMessage(error.message) }, { status: 400 });
    return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: Params) {
    const { pilgrimageId, stayId } = await params;
    const denied = await guardStay(req, pilgrimageId, stayId);
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get('installmentId');
    if (!id) return NextResponse.json({ error: 'Falta a prestação.' }, { status: 400 });
    const { error } = await supabaseServer!.from('pilgrimage_hotel_installments').delete().eq('id', id).eq('stay_id', stayId);
    if (error) return NextResponse.json({ error: missingTableMessage(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true });
}
