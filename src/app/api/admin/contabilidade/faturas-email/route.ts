import { LEDGER_DOCUMENTS_BUCKET } from '../../../../../lib/ledger/mail-invoices';
import { supplierName } from '../../../../../lib/ledger/mail-invoices-parse';
import { db, isMissingTableError, requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LINK_SECONDS = 10 * 60;

type StoredFile = { kind: 'invoice' | 'receipt' | 'detail'; file_name: string; storage_path: string };

/** Faturas recebidas por email que ainda não estão num movimento do banco. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;

  const { data, error } = await db().from('ledger_mail_invoices')
    .select('id, supplier, doc_number, paid_on, received_at, amount, currency, files, status, last_error')
    .in('status', ['waiting', 'outside'])
    .order('paid_on', { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) {
    if (isMissingTableError(error)) return Response.json({ invoices: [] });
    return Response.json({ error: error.message }, { status: 500 });
  }

  const invoices = await Promise.all((data || []).map(async row => {
    const files = await Promise.all(((row.files || []) as StoredFile[]).map(async file => {
      const { data: signed } = await db().storage.from(LEDGER_DOCUMENTS_BUCKET).createSignedUrl(file.storage_path, LINK_SECONDS);
      return { kind: file.kind, fileName: file.file_name, url: signed?.signedUrl || null };
    }));
    return {
      id: row.id,
      supplier: supplierName(String(row.supplier)),
      docNumber: row.doc_number,
      paidOn: row.paid_on || String(row.received_at).slice(0, 10),
      amount: row.amount === null ? null : Number(row.amount),
      currency: row.currency,
      status: row.status as 'waiting' | 'outside',
      note: row.last_error,
      files,
    };
  }));
  return Response.json({ invoices }, { headers: { 'Cache-Control': 'no-store' } });
}
