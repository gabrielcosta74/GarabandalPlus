import { logAdminAudit } from '../../../../../../../../lib/admin-audit';
import { isDocumentKind } from '../../../../../../../../lib/ledger/document-rules';
import { db, requireAdmin } from '../../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

/** Changes what a file is (invoice, receipt, proforma…). The month's lock still applies. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id, docId } = await context.params;
  const body = await req.json().catch(() => null) as { kind?: unknown } | null;
  if (!UUID.test(id) || !UUID.test(docId) || !isDocumentKind(body?.kind)) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  const { data, error } = await db().from('expense_documents').update({ doc_kind: body.kind })
    .eq('id', docId).eq('bank_transaction_id', id).select('id').maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  if (!data) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id, docId } = await context.params;
  if (!UUID.test(id) || !UUID.test(docId)) return Response.json({ error: 'Documento inválido.' }, { status: 400 });

  const { data: document, error: readError } = await db().from('expense_documents')
    .select('id, storage_path, file_name').eq('id', docId).eq('bank_transaction_id', id).maybeSingle();
  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  if (!document) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });

  // The row goes first: a closed month refuses here and the file stays untouched.
  const { error } = await db().from('expense_documents').delete().eq('id', docId);
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await db().storage.from('ledger-documents').remove([document.storage_path]);

  await logAdminAudit({ adminEmail: admin.email, action: 'ledger.remove_document', details: { bank_transaction_id: id, document_id: docId, file_name: document.file_name } });
  return Response.json({ ok: true });
}
