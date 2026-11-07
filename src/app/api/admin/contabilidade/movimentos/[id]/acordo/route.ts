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
  return Response.json({ ok: true });
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
