import { type AgreementSummary } from './agreement-rules';
import { db, isMissingTableError } from './server';

const cents = (value: unknown) => Math.round(Number(value) * 100);

type AgreementRow = {
  id: string; pilgrimage_id: string; hotel_stay_id: string | null; cost_id: string | null; supplier: string;
  description: string | null; total_amount: number; paid_outside_bank: number; status: 'open' | 'cancelled';
};

/** Null before the agreements migration: callers show the feature as not yet active. */
export async function listAgreements(filter: { pilgrimageId?: string; ids?: string[] } = {}): Promise<AgreementSummary[] | null> {
  let query = db().from('supplier_agreements')
    .select('id, pilgrimage_id, hotel_stay_id, cost_id, supplier, description, total_amount, paid_outside_bank, status')
    .order('created_at', { ascending: true });
  if (filter.pilgrimageId) query = query.eq('pilgrimage_id', filter.pilgrimageId);
  if (filter.ids) query = query.in('id', filter.ids.length ? filter.ids : ['00000000-0000-0000-0000-000000000000']);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  const rows = (data || []) as AgreementRow[];
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);

  const [links, documents, pilgrimages, stays, costs] = await Promise.all([
    db().from('bank_transaction_links').select('target_id, amount').eq('target_type', 'agreement').in('target_id', ids),
    db().from('expense_documents').select('agreement_id, doc_kind').in('agreement_id', ids),
    db().from('pilgrimages').select('id, title, start_date').in('id', [...new Set(rows.map(row => row.pilgrimage_id))]),
    db().from('pilgrimage_hotel_stays').select('id, hotel, city, check_in').in('id', rows.map(row => row.hotel_stay_id).filter(Boolean) as string[]),
    db().from('pilgrimage_costs').select('id, kind, supplier, location').in('id', rows.map(row => row.cost_id).filter(Boolean) as string[]),
  ]);
  for (const result of [links, documents, pilgrimages, stays, costs]) if (result.error) throw result.error;

  const paidBy = new Map<string, { sum: number; count: number }>();
  for (const link of links.data || []) {
    const entry = paidBy.get(String(link.target_id)) || { sum: 0, count: 0 };
    paidBy.set(String(link.target_id), { sum: entry.sum + cents(link.amount), count: entry.count + 1 });
  }
  const kinds = new Map<string, Set<string>>();
  for (const document of documents.data || []) {
    const set = kinds.get(String(document.agreement_id)) || new Set<string>();
    set.add(String(document.doc_kind));
    kinds.set(String(document.agreement_id), set);
  }
  const pilgrimage = new Map((pilgrimages.data || []).map(row => [row.id, row]));
  const stay = new Map((stays.data || []).map(row => [row.id, row]));
  const cost = new Map((costs.data || []).map(row => [row.id, row]));

  return rows.map(row => {
    const bank = paidBy.get(row.id) || { sum: 0, count: 0 };
    const paid = (cents(row.paid_outside_bank) + bank.sum) / 100;
    const line = row.hotel_stay_id ? stay.get(row.hotel_stay_id) : null;
    const costLine = row.cost_id ? cost.get(row.cost_id) : null;
    const logisticsLabel = line ? [line.hotel, line.city].filter(Boolean).join(' · ')
      : costLine ? [costLine.supplier, costLine.location].filter(Boolean).join(' · ') || costLine.kind : null;
    const set = kinds.get(row.id) || new Set();
    return {
      id: row.id, pilgrimageId: row.pilgrimage_id,
      pilgrimageTitle: pilgrimage.get(row.pilgrimage_id)?.title || 'Peregrinação',
      pilgrimageStart: pilgrimage.get(row.pilgrimage_id)?.start_date || null,
      supplier: row.supplier, description: row.description, logisticsLabel,
      total: Number(row.total_amount), paidOutsideBank: Number(row.paid_outside_bank),
      paidByBank: bank.sum / 100, paid, remaining: Math.max(0, (cents(row.total_amount) - cents(paid)) / 100),
      payments: bank.count, hasProforma: set.has('proforma'), hasFinalInvoice: set.has('fatura') || set.has('recibo'),
      status: row.status,
    };
  });
}
