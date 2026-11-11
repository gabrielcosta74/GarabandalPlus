import { logAdminAudit } from '../../../../../../../../lib/admin-audit';
import { isDocumentKind } from '../../../../../../../../lib/ledger/document-rules';
import { filesReady, getFile, unlinkFile, updateFile } from '../../../../../../../../lib/ledger/files';
import { db, requireAdmin } from '../../../../../../../../lib/ledger/server';

/** The file, when it's linked to this movement (through any link). */
async function linkedFile(movementId: string, docId: string) {
  const file = await getFile(docId);
  return file && file.links.some(link => link.type === 'bank_transaction' && link.targetId === movementId) ? file : null;
}

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
  if (await filesReady().catch(() => false)) {
    try {
      if (!(await linkedFile(id, docId))) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
      await updateFile(docId, { kind: body.kind });
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível mudar o tipo.' }, { status: 409 });
    }
  }
  const { data, error } = await db().from('expense_documents').update({ doc_kind: body.kind })
    .eq('id', docId).eq('bank_transaction_id', id).select('id').maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  if (!data) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
  return Response.json({ ok: true, action: 'deleted' });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id, docId } = await context.params;
  if (!UUID.test(id) || !UUID.test(docId)) return Response.json({ error: 'Documento inválido.' }, { status: 400 });

  // A file that lives in a folder or justifies other movements is only unlinked here.
  if (await filesReady().catch(() => false)) {
    try {
      const file = await linkedFile(id, docId);
      if (!file) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
      if (file.folderId || file.links.length > 1) {
        await unlinkFile(docId, { type: 'bank_transaction', targetId: id });
        await logAdminAudit({ adminEmail: admin.email, action: 'ledger.file.unlink', details: { bank_transaction_id: id, document_id: docId } });
        return Response.json({ ok: true, action: 'unlinked' });
      }
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível tirar o documento.' }, { status: 409 });
    }
  }

  const { data: document, error: readError } = await db().from('expense_documents')
    .select('id, storage_path, file_name').eq('id', docId).eq('bank_transaction_id', id).maybeSingle();
  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  if (!document) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });

  // The row goes first: a closed month refuses here and the file stays untouched.
  const { error } = await db().from('expense_documents').delete().eq('id', docId);
  if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await db().storage.from('ledger-documents').remove([document.storage_path]);

  await logAdminAudit({ adminEmail: admin.email, action: 'ledger.remove_document', details: { bank_transaction_id: id, document_id: docId, file_name: document.file_name } });
  return Response.json({ ok: true, action: 'deleted' });
}
