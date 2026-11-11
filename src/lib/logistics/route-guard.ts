import { NextResponse } from 'next/server';

import { verifyAdmin } from '../admin-auth';
import { supabaseServer } from '../supabase';

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Admin + a estadia pertence a esta peregrinação. Devolve a resposta de erro
 * pronta, ou null quando pode avançar.
 */
export async function guardStay(req: Request, pilgrimageId: string, stayId: string): Promise<NextResponse | null> {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    if (!UUID.test(pilgrimageId) || !UUID.test(stayId)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    const { data, error: stayError } = await supabaseServer
        .from('pilgrimage_hotel_stays').select('id').eq('id', stayId).eq('pilgrimage_id', pilgrimageId).maybeSingle();
    if (stayError) return NextResponse.json({ error: stayError.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Hotel não encontrado nesta peregrinação.' }, { status: 404 });
    return null;
}

/** Número de um campo do admin; aceita "1.234,50" e "1234.50". */
export function numberOf(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = String(value).trim();
    const parsed = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
    return Number.isFinite(parsed) ? parsed : null;
}

export const isIsoDate = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export const missingTableMessage = (message: string) =>
    /does not exist|schema cache/i.test(message)
        ? 'As tabelas das linhas e prestações ainda não existem. Falta aplicar a migração 20261111200000.'
        : message;
