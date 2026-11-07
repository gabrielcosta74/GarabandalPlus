import { logAdminAudit } from '../../../../../lib/admin-audit';
import { rankAgreements } from '../../../../../lib/ledger/agreement-rules';
import { listAgreements } from '../../../../../lib/ledger/agreements';
import { db, requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

/** Read only. Agreements (proformas), the ones a payment most likely belongs to, and pilgrimages to create one for. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const url = new URL(req.url);
  const pilgrimageId = url.searchParams.get('pilgrimageId');
  const movementId = url.searchParams.get('movementId');
  if ((pilgrimageId && !UUID.test(pilgrimageId)) || (movementId && !UUID.test(movementId))) {
    return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  try {
    const agreements = await listAgreements(pilgrimageId ? { pilgrimageId } : {});
    if (agreements === null) return Response.json({ ready: false, agreements: [], suggested: [], pilgrimages: [] });

    let suggested: string[] = [];
    if (movementId) {
      const { data: movement, error } = await db().from('bank_transactions').select('description_raw, notes, amount').eq('id', movementId).maybeSingle();
      if (error) throw error;
      if (movement) {
        suggested = rankAgreements({ text: `${movement.description_raw} ${movement.notes || ''}`, amount: Number(movement.amount) }, agreements)
          .slice(0, 3).map(agreement => agreement.id);
      }
    }
    const { data: pilgrimages, error: pilgrimagesError } = await db().from('pilgrimages')
      .select('id, title, start_date, status').neq('status', 'draft').order('start_date', { ascending: false }).limit(40);
    if (pilgrimagesError) throw pilgrimagesError;
    return Response.json({ ready: true, agreements, suggested, pilgrimages: pilgrimages || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler os acordos.' }, { status: 500 });
  }
}

/** Creates an agreement from a proforma. It holds no money: payments are linked to it afterwards. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const pilgrimageId = String(body?.pilgrimageId || '');
  const supplier = typeof body?.supplier === 'string' ? body.supplier.trim().slice(0, 120) : '';
  const total = Number(body?.totalAmount);
  const outside = body?.paidOutsideBank === undefined || body?.paidOutsideBank === '' ? 0 : Number(body.paidOutsideBank);
  const hotelStayId = typeof body?.hotelStayId === 'string' && UUID.test(body.hotelStayId) ? body.hotelStayId : null;
  const costId = typeof body?.costId === 'string' && UUID.test(body.costId) ? body.costId : null;
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 300) || null : null;

  if (!UUID.test(pilgrimageId) || !supplier) return Response.json({ error: 'Escolha a peregrinação e escreva o fornecedor.' }, { status: 400 });
  if (!Number.isFinite(total) || total <= 0) return Response.json({ error: 'Indique o valor total da proforma.' }, { status: 400 });
  if (!Number.isFinite(outside) || outside < 0 || outside > total) return Response.json({ error: 'O valor já pago fora do banco não é válido.' }, { status: 400 });
  if (hotelStayId && costId) return Response.json({ error: 'Escolha só uma linha da logística.' }, { status: 400 });

  try {
    // The logistics line must belong to the same pilgrimage.
    if (hotelStayId || costId) {
      const { data: line, error } = await db().from(hotelStayId ? 'pilgrimage_hotel_stays' : 'pilgrimage_costs')
        .select('pilgrimage_id').eq('id', (hotelStayId || costId)!).maybeSingle();
      if (error) throw error;
      if (!line || line.pilgrimage_id !== pilgrimageId) return Response.json({ error: 'Essa linha da logística é de outra peregrinação.' }, { status: 400 });
    }
    const { data, error } = await db().from('supplier_agreements').insert({
      pilgrimage_id: pilgrimageId, hotel_stay_id: hotelStayId, cost_id: costId, supplier, description,
      total_amount: Math.round(total * 100) / 100, paid_outside_bank: Math.round(outside * 100) / 100, created_by: admin.email,
    }).select('id').single();
    if (error) {
      const message = error.code === '23505' ? 'Essa linha da logística já tem um acordo.' : error.message;
      return Response.json({ error: message }, { status: error.code === '23505' ? 409 : 500 });
    }
    if (hotelStayId || costId) await db().rpc('ledger_sync_agreement', { p_agreement_id: data.id });
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.create_agreement', details: { agreement_id: data.id, pilgrimage_id: pilgrimageId, supplier, total } });
    return Response.json({ ok: true, id: data.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível criar o acordo.' }, { status: 500 });
  }
}
