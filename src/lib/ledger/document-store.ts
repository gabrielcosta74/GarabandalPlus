import { createHash } from 'node:crypto';

import { detectDocumentType, documentProblem, isDocumentKind, MAX_DOCUMENT_BYTES, type DocumentKind } from './document-rules';
import { db } from './server';

const BUCKET = 'ledger-documents';

export type StoreResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/**
 * Reads the uploaded file from a form, checks it by its own bytes and keeps it.
 * Used for files that belong to an agreement (proforma, final invoice).
 */
export async function storeAgreementDocument(req: Request, agreementId: string, actor: string): Promise<StoreResult> {
  const length = Number(req.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES + 64 * 1024) return { ok: false, status: 413, error: 'O ficheiro é demasiado grande (máximo 9 MB).' };
  const form = await req.formData();
  const file = form.get('file');
  const kind = form.get('kind') ?? 'proforma';
  if (!file || typeof file === 'string') return { ok: false, status: 400, error: 'Escolha um ficheiro.' };
  if (!isDocumentKind(kind)) return { ok: false, status: 400, error: 'Tipo de documento inválido.' };
  const problem = documentProblem(file);
  if (problem) return { ok: false, status: 400, error: problem };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectDocumentType(bytes);
  if (!type) return { ok: false, status: 400, error: 'Use um PDF ou uma fotografia (JPG, PNG, WEBP ou HEIC).' };

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const { data: repeated, error: repeatedError } = await db().from('expense_documents')
    .select('id').eq('agreement_id', agreementId).eq('sha256', sha256).maybeSingle();
  if (repeatedError) throw repeatedError;
  if (repeated) return { ok: false, status: 409, error: 'Este ficheiro já está neste acordo.' };

  const path = `agreements/${agreementId}/${sha256.slice(0, 32)}.${type.extension}`;
  const { error: uploadError } = await db().storage.from(BUCKET).upload(path, bytes, { contentType: type.mime, upsert: false });
  if (uploadError) throw uploadError;
  const { data: saved, error } = await db().from('expense_documents').insert({
    agreement_id: agreementId, storage_path: path, file_name: file.name, mime_type: type.mime,
    size_bytes: bytes.byteLength, sha256, uploaded_by: actor, doc_kind: kind as DocumentKind,
  }).select('id').single();
  if (error) {
    await db().storage.from(BUCKET).remove([path]);
    return { ok: false, status: error.code === 'P0001' ? 409 : 500, error: error.message };
  }
  return { ok: true, id: saved.id };
}
