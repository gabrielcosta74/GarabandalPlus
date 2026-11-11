
import { createHash } from 'node:crypto';

import { categoryLabel } from './categories';
import { DOCUMENT_KIND_LABELS, MAX_DOCUMENT_BYTES, detectDocumentType, documentProblem, isDocumentKind, type DocumentKind } from './document-rules';
import { FILE_TARGET_TYPES, fileProblem, folderNameProblem, folderPath, type FileTargetType } from './files-rules';
import { db, isMissingTableError } from './server';

/**
 * One place for every accounting file: folders the admin creates, the files in
 * them, and what each file is linked to (bank movements, FACT.pt documents,
 * pilgrimage payments, logistics costs, supplier agreements).
 *
 * Linking only writes to ledger_document_links. It never touches
 * pilgrimage_payments or factpt_documents, so no invoice is ever issued from here.
 */

export const LEDGER_BUCKET = 'ledger-documents';
const BUCKETS = new Set(['ledger-documents', 'accounting-archive']);

export type Folder = { id: string; parentId: string | null; name: string; fileCount: number; unlinkedCount: number };

export type FileMovement = {
  id: string; date: string; period: string; who: string; description: string; amount: number;
  category: string; status: string;
};

export type FileLink = {
  type: FileTargetType;
  targetId: string;
  label: string;
  movement: FileMovement | null;
};

export type LedgerFile = {
  id: string;
  fileName: string;
  kind: DocumentKind;
  kindLabel: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  source: 'email' | 'upload' | 'arquivo';
  docNumber: string | null;
  folderId: string | null;
  folderPath: string[];
  links: FileLink[];
  /** What this file still needs, in one sentence; null when it's done. */
  missing: string | null;
};

export type FileView =
  | { view: 'folder'; folderId: string }
  | { view: 'unfiled' }
  | { view: 'unlinked' }
  | { view: 'search'; q: string }
  | { view: 'movement'; movementId: string };

type DocRow = {
  id: string; file_name: string | null; doc_kind: string | null; mime_type: string | null; size_bytes: number | null;
  created_at: string; uploaded_by: string | null; doc_number: string | null; folder_id: string | null;
  bank_transaction_id: string | null; storage_path: string; storage_bucket: string | null;
};
type LinkRow = { document_id: string; target_type: string; target_id: string; label: string | null; bank_transaction_id: string | null };
type TxRow = { id: string; booking_date: string; period: string; description_raw: string; counterparty_name: string | null; amount: number; category_code: string | null; status: string };

const DOC_COLUMNS = 'id, file_name, doc_kind, mime_type, size_bytes, created_at, uploaded_by, doc_number, folder_id, bank_transaction_id, storage_path, storage_bucket';
const TX_COLUMNS = 'id, booking_date, period, description_raw, counterparty_name, amount, category_code, status';

/** True once the folders migration is applied; every caller degrades to the old behaviour otherwise. */
export async function filesReady(): Promise<boolean> {
  const { error } = await db().from('ledger_document_links').select('id').limit(1);
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw error;
}

export class FilesNotReadyError extends Error {
  constructor() { super('Falta aplicar a migração das pastas (20261111150000) na base de dados.'); }
}

async function assertReady() {
  if (!(await filesReady())) throw new FilesNotReadyError();
}

export class FileActionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

/** Postgres refusals (closed month, duplicate name…) carry their own wording. */
function raise(error: { code?: string; message: string }): never {
  if (error.code === 'P0001') throw new FileActionError(error.message, 409);
  if (error.code === '23505') throw new FileActionError('Já existe uma pasta com esse nome aqui.', 409);
  if (error.code === '23503') throw new FileActionError('A pasta ainda tem ficheiros ou subpastas.', 409);
  throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function listFolders(): Promise<{ folders: Folder[]; unfiled: number; unlinked: number; total: number }> {
  await assertReady();
  const [folders, docs, links] = await Promise.all([
    db().from('ledger_folders').select('id, parent_id, name').order('name', { ascending: true }).limit(2000),
    db().from('expense_documents').select('id, folder_id').limit(20000),
    db().from('ledger_document_links').select('document_id').limit(50000),
  ]);
  if (folders.error) raise(folders.error);
  if (docs.error) raise(docs.error);
  if (links.error) raise(links.error);
  const linked = new Set((links.data || []).map(row => row.document_id as string));
  const files = new Map<string, number>();
  const open = new Map<string, number>();
  let unfiled = 0;
  let unlinked = 0;
  for (const doc of docs.data || []) {
    const folder = doc.folder_id as string | null;
    const isLinked = linked.has(doc.id as string);
    if (!isLinked) unlinked += 1;
    if (!folder) { unfiled += 1; continue; }
    files.set(folder, (files.get(folder) || 0) + 1);
    if (!isLinked) open.set(folder, (open.get(folder) || 0) + 1);
  }
  return {
    folders: (folders.data || []).map(row => ({
      id: row.id as string, parentId: row.parent_id as string | null, name: row.name as string,
      fileCount: files.get(row.id as string) || 0, unlinkedCount: open.get(row.id as string) || 0,
    })),
    unfiled, unlinked, total: (docs.data || []).length,
  };
}

export async function createFolder(input: { name?: unknown; parentId?: unknown }, actor: string): Promise<string> {
  await assertReady();
  const problem = folderNameProblem(input.name);
  if (problem) throw new FileActionError(problem, 400);
  const parentId = typeof input.parentId === 'string' && input.parentId ? input.parentId : null;
  const { data, error } = await db().from('ledger_folders')
    .insert({ name: String(input.name).trim(), parent_id: parentId, created_by: actor }).select('id').single();
  if (error) raise(error);
  return data.id as string;
}

export async function updateFolder(id: string, input: { name?: unknown; parentId?: unknown }): Promise<void> {
  await assertReady();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const problem = folderNameProblem(input.name);
    if (problem) throw new FileActionError(problem, 400);
    patch.name = String(input.name).trim();
  }
  if (input.parentId !== undefined) patch.parent_id = typeof input.parentId === 'string' && input.parentId ? input.parentId : null;
  if (!Object.keys(patch).length) return;
  const { data, error } = await db().from('ledger_folders').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) raise(error);
  if (!data) throw new FileActionError('Pasta não encontrada.', 404);
}

/** Only empty folders go away; files are never deleted with a folder. */
export async function deleteFolder(id: string): Promise<void> {
  await assertReady();
  const [children, files] = await Promise.all([
    db().from('ledger_folders').select('id', { count: 'exact', head: true }).eq('parent_id', id),
    db().from('expense_documents').select('id', { count: 'exact', head: true }).eq('folder_id', id),
  ]);
  if (children.error) raise(children.error);
  if (files.error) raise(files.error);
  if ((children.count || 0) > 0 || (files.count || 0) > 0) {
    throw new FileActionError('Só é possível apagar pastas vazias. Mova primeiro os ficheiros e as subpastas.');
  }
  const { error } = await db().from('ledger_folders').delete().eq('id', id);
  if (error) raise(error);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

async function folderIndex(): Promise<Map<string, { parentId: string | null; name: string }>> {
  const { data, error } = await db().from('ledger_folders').select('id, parent_id, name').limit(2000);
  if (error) raise(error);
  return new Map((data || []).map(row => [row.id as string, { parentId: row.parent_id as string | null, name: row.name as string }]));
}

async function describe(rows: DocRow[]): Promise<LedgerFile[]> {
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const linkRows: LinkRow[] = [];
  for (let index = 0; index < ids.length; index += 300) {
    const { data, error } = await db().from('ledger_document_links')
      .select('document_id, target_type, target_id, label, bank_transaction_id').in('document_id', ids.slice(index, index + 300));
    if (error) raise(error);
    linkRows.push(...((data || []) as LinkRow[]));
  }
  const txIds = [...new Set(linkRows.map(link => link.bank_transaction_id).filter((id): id is string => !!id))];
  const movements = new Map<string, FileMovement>();
  for (let index = 0; index < txIds.length; index += 300) {
    const { data, error } = await db().from('bank_transactions').select(TX_COLUMNS).in('id', txIds.slice(index, index + 300));
    if (error) raise(error);
    for (const tx of (data || []) as TxRow[]) movements.set(tx.id, toMovement(tx));
  }
  const folders = await folderIndex();
  const byDoc = new Map<string, FileLink[]>();
  for (const link of linkRows) {
    if (!(FILE_TARGET_TYPES as readonly string[]).includes(link.target_type)) continue;
    const movement = link.bank_transaction_id ? movements.get(link.bank_transaction_id) || null : null;
    const entry: FileLink = {
      type: link.target_type as FileTargetType, targetId: link.target_id, movement,
      label: link.label || (movement ? movement.who : link.target_id),
    };
    byDoc.set(link.document_id, [...(byDoc.get(link.document_id) || []), entry]);
  }
  return rows.map(row => {
    const kind: DocumentKind = isDocumentKind(row.doc_kind) ? row.doc_kind : 'fatura';
    const links = (byDoc.get(row.id) || []).sort((a, b) => (a.movement?.date || '').localeCompare(b.movement?.date || ''));
    const uploadedBy = row.uploaded_by || '';
    return {
      id: row.id, fileName: row.file_name || 'documento', kind, kindLabel: DOCUMENT_KIND_LABELS[kind],
      mimeType: row.mime_type, sizeBytes: row.size_bytes, createdAt: row.created_at,
      source: uploadedBy.startsWith('email:') ? 'email' : uploadedBy.startsWith('arquivo:') ? 'arquivo' : 'upload',
      docNumber: row.doc_number, folderId: row.folder_id, folderPath: folderPath(folders, row.folder_id),
      links, missing: fileProblem(links.length),
    };
  });
}

function toMovement(tx: TxRow): FileMovement {
  return {
    id: tx.id, date: tx.booking_date, period: tx.period, who: tx.counterparty_name || tx.description_raw,
    description: tx.description_raw, amount: Number(tx.amount),
    category: tx.category_code ? categoryLabel(tx.category_code) : 'Sem categoria', status: tx.status,
  };
}

export async function listFiles(view: FileView): Promise<LedgerFile[]> {
  await assertReady();
  let query = db().from('expense_documents').select(DOC_COLUMNS).order('file_name', { ascending: true }).limit(1000);
  if (view.view === 'folder') query = query.eq('folder_id', view.folderId);
  else if (view.view === 'unfiled') query = query.is('folder_id', null);
  else if (view.view === 'search') {
    const q = view.q.replace(/[%,()]/g, ' ').trim();
    if (q.length < 2) return [];
    query = query.or(`file_name.ilike.%${q}%,doc_number.ilike.%${q}%,supplier.ilike.%${q}%`).limit(200);
  } else if (view.view === 'movement') {
    const { data, error } = await db().from('ledger_document_links').select('document_id')
      .eq('target_type', 'bank_transaction').eq('target_id', view.movementId);
    if (error) raise(error);
    const ids = (data || []).map(row => row.document_id as string);
    if (!ids.length) return [];
    query = query.in('id', ids).order('created_at', { ascending: true });
  } else if (view.view === 'unlinked') {
    const { data, error } = await db().from('ledger_document_links').select('document_id').limit(50000);
    if (error) raise(error);
    const linked = new Set((data || []).map(row => row.document_id as string));
    const { data: all, error: allError } = await db().from('expense_documents').select(DOC_COLUMNS)
      .order('file_name', { ascending: true }).limit(5000);
    if (allError) raise(allError);
    return describe(((all || []) as DocRow[]).filter(row => !linked.has(row.id)).slice(0, 1000));
  }
  const { data, error } = await query;
  if (error) raise(error);
  return describe((data || []) as DocRow[]);
}

export async function getFile(id: string): Promise<LedgerFile | null> {
  await assertReady();
  const { data, error } = await db().from('expense_documents').select(DOC_COLUMNS).eq('id', id).maybeSingle();
  if (error) raise(error);
  if (!data) return null;
  return (await describe([data as DocRow]))[0];
}

/** Uploads one file into a folder (or none), optionally linked to a movement right away. */
export async function storeFile(req: Request, actor: string): Promise<{ id: string }> {
  await assertReady();
  const length = Number(req.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES + 64 * 1024) throw new FileActionError('O ficheiro é demasiado grande (máximo 9 MB).', 413);
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new FileActionError('Escolha um ficheiro.', 400);
  const kind = form.get('kind') ?? 'fatura';
  if (!isDocumentKind(kind)) throw new FileActionError('Tipo de documento inválido.', 400);
  const folderValue = form.get('folderId');
  const folderId = typeof folderValue === 'string' && /^[0-9a-f-]{36}$/i.test(folderValue) ? folderValue : null;
  const movementValue = form.get('movementId');
  const movementId = typeof movementValue === 'string' && /^[0-9a-f-]{36}$/i.test(movementValue) ? movementValue : null;
  const problem = documentProblem(file);
  if (problem) throw new FileActionError(problem, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectDocumentType(bytes);
  if (!type) throw new FileActionError('Use um PDF ou uma fotografia (JPG, PNG, WEBP ou HEIC).', 400);

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const { data: repeated, error: repeatedError } = await db().from('expense_documents')
    .select('id, file_name, folder_id').eq('sha256', sha256).limit(1).maybeSingle();
  if (repeatedError) raise(repeatedError);
  if (repeated) {
    const where = folderPath(await folderIndex(), repeated.folder_id as string | null).join(' / ') || 'Sem pasta';
    throw new FileActionError(`Este ficheiro já existe (${repeated.file_name || 'documento'}, em ${where}).`);
  }

  const path = `files/${folderId || 'sem-pasta'}/${sha256.slice(0, 32)}.${type.extension}`;
  const { error: uploadError } = await db().storage.from(LEDGER_BUCKET).upload(path, bytes, { contentType: type.mime, upsert: false });
  if (uploadError) throw uploadError;
  const { data: saved, error } = await db().from('expense_documents').insert({
    storage_bucket: LEDGER_BUCKET, storage_path: path, file_name: file.name, mime_type: type.mime,
    size_bytes: bytes.byteLength, sha256, uploaded_by: actor, doc_kind: kind, folder_id: folderId,
  }).select('id').single();
  if (error) {
    await db().storage.from(LEDGER_BUCKET).remove([path]);
    raise(error);
  }
  if (movementId) await linkFile(saved.id as string, { type: 'bank_transaction', targetId: movementId }, actor);
  return { id: saved.id as string };
}

export async function updateFile(id: string, input: { folderId?: unknown; kind?: unknown; fileName?: unknown }): Promise<void> {
  await assertReady();
  const patch: Record<string, unknown> = {};
  if (input.folderId !== undefined) patch.folder_id = typeof input.folderId === 'string' && input.folderId ? input.folderId : null;
  if (input.kind !== undefined) {
    if (!isDocumentKind(input.kind)) throw new FileActionError('Tipo de documento inválido.', 400);
    patch.doc_kind = input.kind;
  }
  if (input.fileName !== undefined) {
    const name = typeof input.fileName === 'string' ? input.fileName.trim() : '';
    if (!name || name.length > 200 || /[/\\]/.test(name)) throw new FileActionError('Nome de ficheiro inválido.', 400);
    patch.file_name = name;
  }
  if (!Object.keys(patch).length) return;
  const { data, error } = await db().from('expense_documents').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) raise(error);
  if (!data) throw new FileActionError('Ficheiro não encontrado.', 404);
}

/** Deletes the row first (a closed month refuses here), then the stored bytes. */
export async function deleteFile(id: string): Promise<{ fileName: string | null }> {
  await assertReady();
  const { data: row, error: readError } = await db().from('expense_documents')
    .select('id, storage_path, storage_bucket, file_name').eq('id', id).maybeSingle();
  if (readError) raise(readError);
  if (!row) throw new FileActionError('Ficheiro não encontrado.', 404);
  const { error } = await db().from('expense_documents').delete().eq('id', id);
  if (error) raise(error);
  const bucket = BUCKETS.has(String(row.storage_bucket)) ? String(row.storage_bucket) : LEDGER_BUCKET;
  await db().storage.from(bucket).remove([row.storage_path as string]);
  return { fileName: row.file_name as string | null };
}

/** Short-lived link to open or download a file, wherever it is stored. */
export async function fileUrl(id: string, download = false): Promise<{ url: string; fileName: string | null; mimeType: string | null } | null> {
  const ready = await filesReady();
  const { data, error } = await db().from('expense_documents')
    .select(ready ? 'storage_path, storage_bucket, file_name, mime_type' : 'storage_path, file_name, mime_type').eq('id', id).maybeSingle();
  if (error) raise(error);
  if (!data) return null;
  const row = data as unknown as { storage_path: string; storage_bucket?: string | null; file_name: string | null; mime_type: string | null };
  const bucket = row.storage_bucket && BUCKETS.has(row.storage_bucket) ? row.storage_bucket : LEDGER_BUCKET;
  const { data: signed, error: signError } = await db().storage.from(bucket)
    .createSignedUrl(row.storage_path, 300, download ? { download: row.file_name || true } : undefined);
  if (signError || !signed) throw new Error(signError?.message || 'Sem acesso ao ficheiro.');
  return { url: signed.signedUrl, fileName: row.file_name, mimeType: row.mime_type };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export async function linkFile(id: string, target: { type: unknown; targetId: unknown; label?: unknown }, actor: string): Promise<void> {
  await assertReady();
  if (!(FILE_TARGET_TYPES as readonly unknown[]).includes(target.type)) throw new FileActionError('Ligação inválida.', 400);
  const type = target.type as FileTargetType;
  const targetId = typeof target.targetId === 'string' ? target.targetId.trim() : '';
  if (!targetId || targetId.length > 200) throw new FileActionError('Ligação inválida.', 400);
  const label = typeof target.label === 'string' ? target.label.slice(0, 200) : null;

  const { data: doc, error: docError } = await db().from('expense_documents').select('id, bank_transaction_id').eq('id', id).maybeSingle();
  if (docError) raise(docError);
  if (!doc) throw new FileActionError('Ficheiro não encontrado.', 404);

  if (type === 'bank_transaction') {
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new FileActionError('Movimento inválido.', 400);
    const { data: tx, error: txError } = await db().from('bank_transactions').select('id, status').eq('id', targetId).maybeSingle();
    if (txError) raise(txError);
    if (!tx) throw new FileActionError('Movimento não encontrado.', 404);
    if (!doc.bank_transaction_id) {
      // The old column stays the "main movement"; the trigger writes the link.
      const { error } = await db().from('expense_documents').update({ bank_transaction_id: targetId }).eq('id', id);
      if (error) raise(error);
      return;
    }
  }
  const { error } = await db().from('ledger_document_links').upsert({
    document_id: id, target_type: type, target_id: targetId, label, created_by: actor,
    bank_transaction_id: type === 'bank_transaction' ? targetId : null,
  }, { onConflict: 'document_id,target_type,target_id', ignoreDuplicates: true });
  if (error) raise(error);
}

export async function unlinkFile(id: string, target: { type: unknown; targetId: unknown }): Promise<void> {
  await assertReady();
  if (!(FILE_TARGET_TYPES as readonly unknown[]).includes(target.type) || typeof target.targetId !== 'string') {
    throw new FileActionError('Ligação inválida.', 400);
  }
  const { error } = await db().from('ledger_document_links').delete()
    .eq('document_id', id).eq('target_type', target.type as string).eq('target_id', target.targetId);
  if (error) raise(error);
}

/** Movements to pick from when linking a file: expenses still waiting for a document come first. */
export async function movementCandidates(input: { q?: string | null; period?: string | null }): Promise<Array<FileMovement & { documents: number; needsDocument: boolean }>> {
  const ready = await filesReady();
  let query = db().from('bank_transactions').select(`${TX_COLUMNS}, needs_document, paper_document`)
    .neq('status', 'ignored').order('booking_date', { ascending: false }).limit(80);
  const q = (input.q || '').trim();
  const amount = Number(q.replace(/[€\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  if (q && Number.isFinite(amount) && amount > 0 && /\d/.test(q)) query = query.in('amount', [-amount, amount]);
  else if (q) {
    const safe = q.replace(/[%,()]/g, ' ').trim();
    query = query.or(`description_raw.ilike.%${safe}%,counterparty_name.ilike.%${safe}%`);
  }
  if (input.period && /^\d{4}-\d{2}$/.test(input.period)) query = query.eq('period', input.period);
  const { data, error } = await query;
  if (error) raise(error);
  const rows = (data || []) as Array<TxRow & { needs_document: boolean; paper_document: boolean }>;
  const ids = rows.map(row => row.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: docs, error: docsError } = ready
      ? await db().from('ledger_document_links').select('bank_transaction_id').in('bank_transaction_id', ids)
      : await db().from('expense_documents').select('bank_transaction_id').in('bank_transaction_id', ids);
    if (docsError) raise(docsError);
    for (const doc of docs || []) counts.set(doc.bank_transaction_id as string, (counts.get(doc.bank_transaction_id as string) || 0) + 1);
  }
  const result = rows.map(row => ({
    ...toMovement(row), documents: counts.get(row.id) || 0,
    needsDocument: Number(row.amount) < 0 && row.needs_document && !row.paper_document,
  }));
  const waiting = (item: (typeof result)[number]) => (item.needsDocument && !item.documents ? 0 : 1);
  return result.sort((a, b) => waiting(a) - waiting(b) || b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Readers shared with the rest of the ledger
// ---------------------------------------------------------------------------

/**
 * File names behind each movement, through every link (not only the old
 * "main movement" column). Falls back to the old column before the migration.
 */
/**
 * Movements that pay an agreement which already has its proforma. A deposit
 * to a hotel is documented by the proforma until the final invoice arrives;
 * the agreement itself keeps asking for that final invoice.
 */
async function proformaCoveredMovements(ids?: string[]): Promise<Set<string>> {
  let query = db().from('bank_transaction_links').select('bank_transaction_id, target_id').eq('target_type', 'agreement');
  if (ids) query = query.in('bank_transaction_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const { data: links, error } = await query.limit(50000);
  if (error) {
    if (isMissingTableError(error)) return new Set();
    raise(error);
  }
  const agreementIds = [...new Set((links || []).map(link => String(link.target_id)))];
  if (!agreementIds.length) return new Set();
  const { data: proformas, error: proformaError } = await db().from('expense_documents')
    .select('agreement_id').eq('doc_kind', 'proforma').in('agreement_id', agreementIds);
  if (proformaError) {
    if (isMissingTableError(proformaError)) return new Set();
    raise(proformaError);
  }
  const withProforma = new Set((proformas || []).map(row => String(row.agreement_id)));
  return new Set((links || []).filter(link => withProforma.has(String(link.target_id))).map(link => String(link.bank_transaction_id)));
}

export async function documentsByMovement(ids: string[]): Promise<Record<string, string[]>> {
  const result = await ownDocumentsByMovement(ids);
  for (const id of await proformaCoveredMovements(ids)) if (!result[id]?.length) result[id] = ['Proforma do acordo'];
  return result;
}

async function ownDocumentsByMovement(ids: string[]): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (!ids.length) return result;
  if (await filesReady()) {
    for (let index = 0; index < ids.length; index += 300) {
      const { data, error } = await db().from('ledger_document_links')
        .select('bank_transaction_id, expense_documents!inner(file_name)')
        .in('bank_transaction_id', ids.slice(index, index + 300));
      if (error) raise(error);
      for (const row of (data || []) as unknown as Array<{ bank_transaction_id: string; expense_documents: { file_name: string | null } | null }>) {
        (result[row.bank_transaction_id] ||= []).push(row.expense_documents?.file_name || 'documento');
      }
    }
    return result;
  }
  for (let index = 0; index < ids.length; index += 300) {
    const { data, error } = await db().from('expense_documents').select('bank_transaction_id, file_name').in('bank_transaction_id', ids.slice(index, index + 300));
    if (error) raise(error);
    for (const row of data || []) (result[row.bank_transaction_id as string] ||= []).push((row.file_name as string | null) || 'documento');
  }
  return result;
}

/** Every movement with at least one file, through any link. */
export async function documentedMovementIds(): Promise<Set<string>> {
  const ready = await filesReady();
  const { data, error } = ready
    ? await db().from('ledger_document_links').select('bank_transaction_id').not('bank_transaction_id', 'is', null).limit(50000)
    : await db().from('expense_documents').select('bank_transaction_id').limit(50000);
  if (error) raise(error);
  const ids = new Set((data || []).map(row => row.bank_transaction_id as string).filter(Boolean));
  for (const id of await proformaCoveredMovements()) ids.add(id);
  return ids;
}

export { FILE_TARGET_TYPES };
export type { FileTargetType };
