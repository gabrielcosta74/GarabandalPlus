import { createHash } from 'node:crypto';

import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { MAX_DOCUMENT_BYTES, detectDocumentType, documentProblem, documentStoragePath, isDocumentKind } from '../../../../../../../lib/ledger/document-rules';
import { fileUrl, filesReady, listFiles } from '../../../../../../../lib/ledger/files';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;
const BUCKET = 'ledger-documents';
const LINK_SECONDS = 300;

/** The month's lock is enforced by the database; this only words its refusal. */
const refusal = (error: { code?: string; message: string }) =>
  Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: 'Movimento inválido.' }, { status: 400 });

  try {
    if (await filesReady()) {
      // Every file linked to this movement, wherever it lives (folder, email, upload).
      const files = await listFiles({ view: 'movement', movementId: id });
      const documents = await Promise.all(files.map(async file => ({
        id: file.id, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, kind: file.kind,
        source: file.source, createdAt: file.createdAt, folderPath: file.folderPath,
        otherMovements: file.links.filter(link => link.type === 'bank_transaction' && link.targetId !== id).length,
        url: (await fileUrl(file.id).catch(() => null))?.url ?? null,
      })));
      return Response.json({ ready: true, documents }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler os documentos.' }, { status: 500 });
  }

  const { data, error } = await db().from('expense_documents')
    .select('id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at, doc_kind')
    .eq('bank_transaction_id', id).order('created_at', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const documents = await Promise.all((data || []).map(async document => {
    const { data: signed } = await db().storage.from(BUCKET).createSignedUrl(document.storage_path, LINK_SECONDS);
    return {
      id: document.id, fileName: document.file_name, mimeType: document.mime_type, sizeBytes: document.size_bytes, kind: document.doc_kind,
      uploadedBy: document.uploaded_by, createdAt: document.created_at, url: signed?.signedUrl ?? null,
    };
  }));
  return Response.json({ documents }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: 'Movimento inválido.' }, { status: 400 });
  const length = Number(req.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES + 64 * 1024) {
    return Response.json({ error: 'O ficheiro é demasiado grande (máximo 9 MB).' }, { status: 413 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return Response.json({ error: 'Escolha um ficheiro.' }, { status: 400 });
    const kind = form.get('kind');
    if (kind !== null && !isDocumentKind(kind)) return Response.json({ error: 'Tipo de documento inválido.' }, { status: 400 });
    const problem = documentProblem(file);
    if (problem) return Response.json({ error: problem }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectDocumentType(bytes);
    if (!type) return Response.json({ error: 'Use um PDF ou uma fotografia (JPG, PNG, WEBP ou HEIC).' }, { status: 400 });

    const { data: movement, error: movementError } = await db().from('bank_transactions')
      .select('id, period, amount, status').eq('id', id).maybeSingle();
    if (movementError) throw movementError;
    if (!movement || Number(movement.amount) >= 0) return Response.json({ error: 'Só as despesas levam documento.' }, { status: 409 });
    if (movement.status === 'ignored') return Response.json({ error: 'Este movimento está ignorado.' }, { status: 409 });

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const { data: repeated, error: repeatedError } = await db().from('expense_documents')
      .select('id').eq('bank_transaction_id', id).eq('sha256', sha256).maybeSingle();
    if (repeatedError) throw repeatedError;
    if (repeated) return Response.json({ error: 'Este ficheiro já está neste movimento.' }, { status: 409 });

    const path = documentStoragePath(movement.period, id, sha256, type.extension);
    const { error: uploadError } = await db().storage.from(BUCKET)
      .upload(path, bytes, { contentType: type.mime, upsert: false });
    if (uploadError) throw uploadError;

    const { data: saved, error: saveError } = await db().from('expense_documents').insert({
      bank_transaction_id: id, storage_path: path, file_name: file.name, mime_type: type.mime,
      size_bytes: bytes.byteLength, sha256, uploaded_by: admin.email, doc_kind: kind || 'fatura',
    }).select('id').single();
    if (saveError) {
      // A closed month refuses the row: leave no orphan file behind.
      await db().storage.from(BUCKET).remove([path]);
      return refusal(saveError);
    }

    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.attach_document', details: { bank_transaction_id: id, document_id: saved.id, file_name: file.name } });
    return Response.json({ ok: true, id: saved.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível guardar o ficheiro.' }, { status: 500 });
  }
}
