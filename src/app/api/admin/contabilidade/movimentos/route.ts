import {
  db,
  getMontepioAccount,
  isMissingTableError,
  requireAdmin,
  type LedgerMovement,
} from '../../../../../lib/ledger/server';
import { bankLiveConfigured, loadBankLive } from '../../../../../lib/ledger/bank-live';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELECT = [
  'id', 'period', 'booking_date', 'value_date', 'description_raw', 'amount', 'balance_after',
  'parsed_kind', 'category_code', 'counterparty_name', 'needs_document', 'paper_document',
  'status', 'ignore_reason', 'notes', 'reviewed_by', 'reviewed_at', 'raw',
].join(', ');

async function bankConnection() {
  const account = await getMontepioAccount();
  if (!account) return null;
  const { data, error } = await db().from('bank_connections')
    .select('last_synced_at, last_attempt_at, next_attempt_at, manual_blocked_until, last_error_code, last_balance, balance_checked_at, balance_limited_until, valid_until')
    .eq('account_id', account.id).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  // Absent before its migration: the option then simply stays off.
  const { data: issuing } = await db().from('bank_accounts').select('app_donation_fr_from').eq('id', account.id).maybeSingle();
  return {
    donationIssueFrom: (issuing?.app_donation_fr_from as string | null | undefined) ?? null,
    fetchedAt: data.last_synced_at,
    nextRefreshAt: data.next_attempt_at,
    rateLimited: data.last_error_code === 'ASPSP_RATE_LIMIT_EXCEEDED',
    balanceLimited: !!data.balance_limited_until && Date.parse(data.balance_limited_until) > Date.now(),
    validUntil: data.valid_until,
    balance: data.last_balance === null ? null : Number(data.last_balance),
    balanceCheckedAt: data.balance_checked_at,
    lastErrorCode: data.last_error_code,
    lastAttemptAt: data.last_attempt_at,
    manualBlockedUntil: data.manual_blocked_until && Date.parse(data.manual_blocked_until) > Date.now() ? data.manual_blocked_until : null,
  };
}

/** Movements of one month (default: the latest month with movements). */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;

  try {
    const url = new URL(req.url);
    const { data: periodRows, error: periodError } = await db()
      .from('bank_transactions')
      .select('period')
      .order('period', { ascending: false })
      .limit(5000);
    if (periodError) {
      if (isMissingTableError(periodError)) {
        // No ledger tables yet: show the account straight from the bank (read-only).
        if (bankLiveConfigured()) {
          try {
            const live = await loadBankLive({ force: url.searchParams.get('refresh') === '1' });
            return Response.json({ dbReady: false, source: 'bank', bank: { fetchedAt: live.fetchedAt, nextRefreshAt: live.nextRefreshAt, rateLimited: live.rateLimited, balanceLimited: live.balanceLimited, validUntil: live.validUntil, balance: live.balance }, movements: live.movements });
          } catch (bankError) {
            const message = bankError instanceof Error ? bankError.message : 'Erro no banco.';
            return Response.json({ dbReady: false, source: 'bank', bankError: message, movements: [] });
          }
        }
        return Response.json({ dbReady: false, periods: [], movements: [] });
      }
      throw periodError;
    }
    const periods = [...new Set((periodRows || []).map(row => row.period as string))];
    const bank = await bankConnection();
    const requested = url.searchParams.get('period');
    const period = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : periods[0];
    if (!period) return Response.json({ dbReady: true, periods: [], movements: [], period: null, bank });

    const { data, error } = await db()
      .from('bank_transactions')
      .select(SELECT)
      .eq('period', period)
      .order('booking_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- row shape comes from the SELECT list above
    const rows = (data || []) as unknown as Record<string, any>[];
    const ids = rows.map(row => row.id as string);

    const [links, documents, closed] = await Promise.all([
      ids.length
        ? db().from('bank_transaction_links').select('bank_transaction_id, target_type, target_id, label, method').in('bank_transaction_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? db().from('expense_documents').select('bank_transaction_id').in('bank_transaction_id', ids)
        : Promise.resolve({ data: [], error: null }),
      db().from('ledger_periods').select('status, closed_by, closed_at').eq('period', period).maybeSingle(),
    ]);

    const invoiceRefs = new Map<string, string[]>();
    const invoiceFromApp = new Set<string>();
    const linkedPayments = new Map<string, string>();
    const linkedPaymentLabels = new Map<string, string>();
    const linkedDonations = new Set<string>();
    (links.data || []).forEach((link: { bank_transaction_id: string; target_type: string; target_id: string | null; label: string | null; method?: string }) => {
      if ((link.target_type === 'pilgrimage_payment' || link.target_type === 'donation') && link.target_id) {
        linkedPayments.set(link.bank_transaction_id, link.target_id);
        if (link.target_type === 'donation') linkedDonations.add(link.bank_transaction_id);
        if (link.label) linkedPaymentLabels.set(link.bank_transaction_id, link.label);
      }
      if (link.target_type !== 'factpt_document' || !link.label) return;
      invoiceRefs.set(link.bank_transaction_id, [...(invoiceRefs.get(link.bank_transaction_id) || []), link.label]);
      if (link.method === 'rule') invoiceFromApp.add(link.bank_transaction_id);
    });
    // FR the app already issued for the site payment a movement is linked to.
    const linkedPaymentIds = [...new Set(linkedPayments.values())];
    const appInvoiceByPayment = new Map<string, { number: string | null; status: string }>();
    if (linkedPaymentIds.length) {
      const { data: appDocs, error: appDocsError } = await db().from('factpt_documents')
        .select('source_id, factpt_number, status')
        .eq('environment', 'production').in('source_table', ['pilgrimage_payments', 'donations'])
        .in('source_id', linkedPaymentIds);
      if (appDocsError) throw appDocsError;
      (appDocs || []).forEach(doc => {
        appInvoiceByPayment.set(String(doc.source_id), { number: doc.factpt_number, status: doc.status });
      });
    }
    const documentCount = new Map<string, number>();
    (documents.data || []).forEach((doc: { bank_transaction_id: string }) => {
      documentCount.set(doc.bank_transaction_id, (documentCount.get(doc.bank_transaction_id) || 0) + 1);
    });

    const movements: LedgerMovement[] = rows.map(row => ({
      id: row.id,
      period: row.period,
      bookingDate: row.booking_date,
      valueDate: row.value_date,
      description: row.description_raw,
      amount: Number(row.amount),
      balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
      kind: row.parsed_kind,
      categoryCode: row.category_code,
      suggestedCategoryCode: row.category_code || row.raw?.suggested_category || null,
      counterpartyName: row.counterparty_name,
      needsDocument: row.needs_document,
      paperDocument: row.paper_document,
      documentCount: documentCount.get(row.id) || 0,
      invoiceRefs: invoiceRefs.get(row.id) || [],
      invoiceFromApp: invoiceFromApp.has(row.id),
      linkedPaymentId: linkedPayments.get(row.id) || null,
      linkedPaymentLabel: linkedPaymentLabels.get(row.id) || null,
      linkedPaymentKind: linkedPayments.has(row.id) ? (linkedDonations.has(row.id) ? 'donation' : 'pilgrimage') : null,
      appInvoiceRef: (() => {
        const paymentId = linkedPayments.get(row.id);
        const doc = paymentId ? appInvoiceByPayment.get(paymentId) : null;
        return doc && ['issued', 'email_failed'].includes(doc.status) ? doc.number : null;
      })(),
      appInvoiceState: (() => {
        const paymentId = linkedPayments.get(row.id);
        const doc = paymentId ? appInvoiceByPayment.get(paymentId) : null;
        if (!doc) return null;
        if (doc.number && ['issued', 'email_failed'].includes(doc.status)) return 'issued';
        return ['failed', 'needs_data'].includes(doc.status) ? 'failed' : 'processing';
      })(),
      suggestion: row.raw?.suggestion && typeof row.raw.suggestion === 'object' ? {
        confidence: String(row.raw.suggestion.confidence || ''),
        reason: String(row.raw.suggestion.reason || ''),
        invoiceRef: row.raw.suggestion.invoiceRef ? String(row.raw.suggestion.invoiceRef) : null,
        invoiceRefs: Array.isArray(row.raw.suggestion.invoiceRefs) ? row.raw.suggestion.invoiceRefs.map(String) : [],
      } : null,
      status: row.status,
      ignoreReason: row.ignore_reason,
      notes: row.notes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
    }));

    return Response.json({
      dbReady: true,
      period,
      periods,
      closed: closed.data?.status === 'closed' ? closed.data : null,
      bank,
      movements,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os movimentos.';
    return Response.json({ error: message }, { status: 500 });
  }
}
