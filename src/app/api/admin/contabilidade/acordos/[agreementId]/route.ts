import { logAdminAudit } from '../../../../../../lib/admin-audit';
import { listAgreements } from '../../../../../../lib/ledger/agreements';
import { db, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

/** Text from the admin's own number input: accepts "13.000,50" and "13000.50". */
const amountOf = (value: unknown) => {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return NaN;
  return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
};

/**
 * Corrects an agreement: supplier, total, what was paid outside the bank and the
 * logistics line. The database refuses a total below what was already paid.
 */
export async function PATCH(req: Request, context: { params: Promise<{ agreementId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { agreementId } = await context.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!UUID.test(agreementId) || !body) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });

  const supplier = typeof body.supplier === 'string' ? body.supplier.trim() : '';
  const total = amountOf(body.totalAmount);
  const outside = body.paidOutsideBank === undefined || body.paidOutsideBank === '' ? 0 : amountOf(body.paidOutsideBank);
  const description = typeof body.description === 'string' ? body.description : null;
  const hotelStayId = typeof body.hotelStayId === 'string' && UUID.test(body.hotelStayId) ? body.hotelStayId : null;
  const costId = typeof body.costId === 'string' && UUID.test(body.costId) ? body.costId : null;
  if (!supplier) return Response.json({ error: 'Escreva o fornecedor.' }, { status: 400 });
  if (!Number.isFinite(total) || total <= 0) return Response.json({ error: 'Indique o valor total da proforma.' }, { status: 400 });
  if (!Number.isFinite(outside) || outside < 0) return Response.json({ error: 'O valor já pago fora do banco não é válido.' }, { status: 400 });

  const { error } = await db().rpc('ledger_update_agreement', {
    p_agreement_id: agreementId, p_supplier: supplier, p_description: description,
    p_total: Math.round(total * 100) / 100, p_paid_outside_bank: Math.round(outside * 100) / 100,
    p_hotel_stay_id: hotelStayId, p_cost_id: costId,
  });
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await logAdminAudit({
    adminEmail: admin.email, action: 'ledger.update_agreement',
    details: { agreement_id: agreementId, supplier, total, paid_outside_bank: outside, hotel_stay_id: hotelStayId, cost_id: costId },
  });
  return Response.json({ ok: true });
}

/** Cancels an agreement with nothing paid. Agreements with payments are corrected, never removed. */
export async function DELETE(req: Request, context: { params: Promise<{ agreementId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { agreementId } = await context.params;
  if (!UUID.test(agreementId)) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  const { error } = await db().rpc('ledger_cancel_agreement', { p_agreement_id: agreementId });
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await logAdminAudit({ adminEmail: admin.email, action: 'ledger.cancel_agreement', details: { agreement_id: agreementId } });
  return Response.json({ ok: true });
}

/** Read only. One agreement with its payments and its documents. */
export async function GET(req: Request, context: { params: Promise<{ agreementId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { agreementId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(agreementId)) return Response.json({ error: 'Acordo inválido.' }, { status: 400 });
  try {
    const [agreement] = (await listAgreements({ ids: [agreementId] })) || [];
    if (!agreement) return Response.json({ error: 'Acordo não encontrado.' }, { status: 404 });
    const { data: links, error } = await db().from('bank_transaction_links').select('bank_transaction_id').eq('target_type', 'agreement').eq('target_id', agreementId);
    if (error) throw error;
    const ids = (links || []).map(link => link.bank_transaction_id as string);
    const [movements, files] = await Promise.all([
      ids.length ? db().from('bank_transactions').select('id, booking_date, amount, description_raw, period').in('id', ids).order('booking_date') : Promise.resolve({ data: [], error: null }),
      db().from('expense_documents').select('id, file_name, doc_kind, storage_path, bank_transaction_id, agreement_id')
        .or(`agreement_id.eq.${agreementId}${ids.length ? `,bank_transaction_id.in.(${ids.join(',')})` : ''}`),
    ]);
    for (const result of [movements, files]) if (result.error) throw result.error;
    const documents = await Promise.all((files.data || []).map(async file => {
      const { data: signed } = await db().storage.from('ledger-documents').createSignedUrl(file.storage_path, 300);
      return { id: file.id, fileName: file.file_name, kind: file.doc_kind, onAgreement: !!file.agreement_id, movementId: file.bank_transaction_id, url: signed?.signedUrl ?? null };
    }));
    return Response.json({ agreement, payments: movements.data || [], documents }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler o acordo.' }, { status: 500 });
  }
}
