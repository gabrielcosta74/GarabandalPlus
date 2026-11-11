import { addDays } from './invoice-safety';
import { nextPeriodStart, type CloseInvoice, type CloseMovement, type MonthData } from './month-close-rules';
import { db } from './server';
import { documentsByMovement } from './files';

const REFUNDED = /refund|cancel|anul/i;
const toRef = (number: string) => (number.startsWith('FR ') ? number : `FR ${number}`);
const seriesOf = (number: string) => number.match(/^(?:FR )?\d{4}([A-Z]+)\//)?.[1] || '?';

/** Everything the close and the accountant's workbook need for one month. Read only. */
export async function loadMonthData(period: string): Promise<MonthData> {
  const start = `${period}-01`;
  const end = addDays(nextPeriodStart(period), -1);

  const { data: rows, error } = await db().from('bank_transactions')
    .select('id, booking_date, value_date, description_raw, amount, status, category_code, needs_document, paper_document, notes, created_at')
    .eq('period', period).order('booking_date', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  const movements: CloseMovement[] = (rows || []).map(row => ({ ...row, amount: Number(row.amount) })) as CloseMovement[];
  const ids = movements.map(movement => movement.id);

  const [links, files, allLinks, connection, later] = await Promise.all([
    ids.length ? db().from('bank_transaction_links').select('bank_transaction_id, target_type, target_id').in('bank_transaction_id', ids) : Promise.resolve({ data: [], error: null }),
    documentsByMovement(ids).then(data => ({ data, error: null })),
    db().from('bank_transaction_links').select('target_id').eq('target_type', 'factpt_document'),
    db().from('bank_connections').select('last_balance, last_synced_at').limit(1).maybeSingle(),
    db().from('bank_transactions').select('amount').gt('period', period),
  ]);
  for (const result of [links, files, allLinks, connection, later]) if (result.error) throw result.error;

  const invoiceRefs: Record<string, string[]> = {};
  for (const link of links.data || []) {
    if (link.target_type !== 'factpt_document' || !link.target_id) continue;
    (invoiceRefs[link.bank_transaction_id] ||= []).push(String(link.target_id));
  }
  // Every file linked to the movement, wherever it lives (folder, email, upload).
  const documents: Record<string, string[]> = files.data || {};

  const linkedRefs = [...new Set(Object.values(invoiceRefs).flat())];
  const APP_COLUMNS = 'factpt_number, amount, payment_method, payment_confirmed_at, issued_at, status, fiscal_snapshot';
  const [inMonth, linkedMirror, appInMonth, appLinked] = await Promise.all([
    db().from('factpt_remote_documents').select('number, gross, doc_date, payment_status, client_name, identifier_id')
      .eq('doc_type', 'invoicereceipt').gte('doc_date', start).lte('doc_date', end),
    linkedRefs.length
      ? db().from('factpt_remote_documents').select('number, gross, doc_date, payment_status, client_name, identifier_id')
        .eq('doc_type', 'invoicereceipt').in('number', linkedRefs.map(ref => ref.replace(/^FR /, '')))
      : Promise.resolve({ data: [], error: null }),
    db().from('factpt_documents').select(APP_COLUMNS).eq('environment', 'production').not('factpt_number', 'is', null)
      .gte('issued_at', start).lt('issued_at', nextPeriodStart(period)),
    linkedRefs.length
      ? db().from('factpt_documents').select(APP_COLUMNS).eq('environment', 'production').in('factpt_number', linkedRefs)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [inMonth, linkedMirror, appInMonth, appLinked]) if (result.error) throw result.error;
  const appDocs = { data: [...(appInMonth.data || []), ...(appLinked.data || [])] };

  const invoices = new Map<string, CloseInvoice>();
  for (const doc of [...(inMonth.data || []), ...(linkedMirror.data || [])]) {
    const number = toRef(doc.number);
    invoices.set(number, {
      number, series: seriesOf(number), date: doc.doc_date, gross: Number(doc.gross), name: doc.client_name,
      method: null, refunded: REFUNDED.test(doc.payment_status || ''), fromApp: String(doc.identifier_id || '').startsWith('gp:'),
    });
  }
  // The app knows the payer and the payment method for its own FRs.
  for (const doc of appDocs.data || []) {
    const number = toRef(String(doc.factpt_number));
    const known = invoices.get(number);
    const customer = (doc.fiscal_snapshot as { customer?: { name?: string } } | null)?.customer?.name || null;
    invoices.set(number, {
      number, series: seriesOf(number),
      date: known?.date || String(doc.issued_at || doc.payment_confirmed_at).slice(0, 10),
      gross: known?.gross ?? Number(doc.amount), name: customer || known?.name || null,
      method: doc.payment_method, refunded: known?.refunded ?? false, fromApp: true,
    });
  }

  const cents = (value: unknown) => Math.round(Number(value) * 100);
  const balance = connection.data?.last_balance;
  const closing = balance === null || balance === undefined ? null
    : (cents(balance) - (later.data || []).reduce((sum, row) => sum + cents(row.amount), 0)) / 100;
  const opening = closing === null ? null
    : (cents(closing) - movements.reduce((sum, movement) => sum + cents(movement.amount), 0)) / 100;

  return {
    period, movements, invoiceRefs, documents, invoices: [...invoices.values()],
    linkedAnywhere: (allLinks.data || []).map(link => String(link.target_id)),
    opening, closing, bankReadAt: connection.data?.last_synced_at ?? null,
  };
}

export function currentLisbonPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`;
}
