import { categoryLabel } from './categories';
import { archiveFileName, DOCUMENT_KIND_LABELS, isDocumentKind } from './document-rules';
import { db } from './server';

export type ArchivedDocument = {
  id: string;
  kind: string;
  kindLabel: string;
  fileName: string | null;
  sizeBytes: number | null;
  /** application/pdf, image/jpeg… — decides how the page previews it. */
  mimeType: string | null;
  /** email = arrived on its own from the geral@ inbox; upload = attached by hand. */
  source: 'email' | 'upload';
  /** Supplier's document number, when known (search). */
  docNumber: string | null;
  storagePath: string;
  createdAt: string;
  movement: { id: string; date: string; period: string; who: string; description: string; amount: number; category: string };
};

type Row = {
  id: string; doc_kind: string | null; file_name: string | null; size_bytes: number | null; storage_path: string; created_at: string;
  mime_type: string | null; uploaded_by: string | null; doc_number: string | null;
  bank_transactions: { id: string; booking_date: string; period: string; description_raw: string; counterparty_name: string | null; amount: number; category_code: string | null } | null;
};

/** Read only. Every expense document of a year (or a month), with the movement it justifies. */
export async function listDocuments(scope: { year?: string; period?: string }): Promise<ArchivedDocument[]> {
  let query = db().from('expense_documents')
    .select('id, doc_kind, file_name, size_bytes, storage_path, created_at, mime_type, uploaded_by, doc_number, bank_transactions!inner(id, booking_date, period, description_raw, counterparty_name, amount, category_code)')
    .order('created_at', { ascending: true })
    .limit(5000);
  if (scope.period) query = query.eq('bank_transactions.period', scope.period);
  else if (scope.year) query = query.like('bank_transactions.period', `${scope.year}-%`);
  const { data, error } = await query;
  if (error) throw error;
  return ((data || []) as unknown as Row[])
    .filter(row => row.bank_transactions)
    .map(row => {
      const movement = row.bank_transactions!;
      const kind = isDocumentKind(row.doc_kind) ? row.doc_kind : 'fatura';
      return {
        id: row.id, kind, kindLabel: DOCUMENT_KIND_LABELS[kind], fileName: row.file_name, sizeBytes: row.size_bytes,
        mimeType: row.mime_type, source: (row.uploaded_by || '').startsWith('email:') ? 'email' as const : 'upload' as const,
        docNumber: row.doc_number, storagePath: row.storage_path, createdAt: row.created_at,
        movement: {
          id: movement.id, date: movement.booking_date, period: movement.period,
          who: movement.counterparty_name || movement.description_raw, description: movement.description_raw,
          amount: Number(movement.amount), category: movement.category_code ? categoryLabel(movement.category_code) : 'Sem categoria',
        },
      };
    })
    .sort((a, b) => a.movement.date.localeCompare(b.movement.date));
}

/** Where a file goes inside the month's ZIP: one folder per category, readable names, no clashes. */
export function archivePaths(documents: ArchivedDocument[]): Map<string, string> {
  const used = new Set<string>();
  const paths = new Map<string, string>();
  for (const document of documents) {
    const extension = document.storagePath.split('.').pop() || 'pdf';
    const folder = document.movement.category.replace(/[\\/:*?"<>|]+/g, '-');
    let index = 0;
    let path = '';
    do {
      path = `${folder}/${archiveFileName({ date: document.movement.date, who: document.movement.who, amount: document.movement.amount, kind: document.kindLabel, extension, index })}`;
      index += 1;
    } while (used.has(path));
    used.add(path);
    paths.set(document.id, path);
  }
  return paths;
}
