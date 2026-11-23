import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

/** Ties a bank payment to an agreement. The database refuses a payment above what is left. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as { agreementId?: string } | null;
  if (!UUID.test(id) || !body?.agreementId || !UUID.test(body.agreementId)) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  const { error } = await db().rpc('ledger_link_agreement_payment', { p_transaction_id: id, p_agreement_id: body.agreementId, p_actor: admin.email });
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await logAdminAudit({ adminEmail: admin.email, action: 'ledger.link_agreement', details: { bank_transaction_id: id, agreement_id: body.agreementId } });
  await suggestLodging(id, body.agreementId).catch(() => undefined);
  return Response.json({ ok: true });
}

/**
 * A payment to a hotel's agreement is lodging. Leaves it as a suggestion (the
 * same place the classifier writes to) so the admin still confirms it, and only
 * when nobody chose a category yet. Best effort: the link above already stands.
 */
async function suggestLodging(movementId: string, agreementId: string) {
  const { data: agreement } = await db().from('supplier_agreements').select('hotel_stay_id').eq('id', agreementId).maybeSingle();
  if (!agreement?.hotel_stay_id) return;
  const { data: movement } = await db().from('bank_transactions').select('category_code, raw').eq('id', movementId).maybeSingle();
  if (!movement || movement.category_code) return;
  const raw = movement.raw && typeof movement.raw === 'object' ? movement.raw as Record<string, unknown> : {};
  if (raw.suggested_category) return;
  await db().from('bank_transactions').update({ raw: { ...raw, suggested_category: 'alojamento' } })
    .eq('id', movementId).is('category_code', null);
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  const { error } = await db().rpc('ledger_unlink_agreement_payment', { p_transaction_id: id, p_actor: admin.email });
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await logAdminAudit({ adminEmail: admin.email, action: 'ledger.unlink_agreement', details: { bank_transaction_id: id } });
  return Response.json({ ok: true });
}
