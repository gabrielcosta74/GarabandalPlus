import { db, isMissingTableError, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KIND: Record<string, string> = { restaurant: 'Restaurante', transport: 'Transporte', flight: 'Voo', museum: 'Visita', other: 'Outro' };

/** Read only. The pilgrimage's hotels and services an agreement can be tied to. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const pilgrimageId = new URL(req.url).searchParams.get('pilgrimageId') || '';
  if (!/^[0-9a-f-]{36}$/i.test(pilgrimageId)) return Response.json({ error: 'Peregrinação inválida.' }, { status: 400 });
  try {
    const [stays, costs, taken] = await Promise.all([
      db().from('pilgrimage_hotel_stays').select('id, hotel, city, check_in, check_out, paid_amount').eq('pilgrimage_id', pilgrimageId).order('check_in'),
      db().from('pilgrimage_costs').select('id, kind, supplier, location, cost_date, paid_amount').eq('pilgrimage_id', pilgrimageId).order('display_order'),
      db().from('supplier_agreements').select('hotel_stay_id, cost_id').eq('pilgrimage_id', pilgrimageId),
    ]);
    for (const result of [stays, costs]) if (result.error) throw result.error;
    const used = new Set((taken.error && isMissingTableError(taken.error) ? [] : taken.data || []).flatMap(row => [row.hotel_stay_id, row.cost_id]).filter(Boolean));
    const lines = [
      ...(stays.data || []).map(stay => ({ type: 'stay' as const, id: stay.id, label: `Hotel · ${[stay.hotel, stay.city].filter(Boolean).join(', ') || 'sem nome'}`, supplier: stay.hotel || '', date: stay.check_in, taken: used.has(stay.id) })),
      ...(costs.data || []).map(cost => ({ type: 'cost' as const, id: cost.id, label: `${KIND[cost.kind] || cost.kind} · ${[cost.supplier, cost.location].filter(Boolean).join(', ') || 'sem nome'}`, supplier: cost.supplier || cost.location || '', date: cost.cost_date, taken: used.has(cost.id) })),
    ];
    return Response.json({ lines }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler a logística.' }, { status: 500 });
  }
}
