import 'server-only';

import { createHash } from 'node:crypto';

import { classifyMovement, movementMatchKey } from './classify';
import { bankLiveConfigured } from './bank-live';
import { fetchBalances, fetchTransactions, toStatementLine, type PsuContext } from './enable-banking';
import { db, getMontepioAccount, loadCustomRules } from './server';

type Claim = {
  acquired: boolean;
  leaseToken?: string;
  dateFrom?: string;
  fetchBalance?: boolean;
  historyGap?: boolean;
  nextAttemptAt?: string;
  expired?: boolean;
  manualBlocked?: boolean;
};

export type BankSyncResult = {
  status: 'synced' | 'waiting' | 'expired' | 'not_configured' | 'not_ready' | 'rate_limited' | 'failed';
  rowsNew?: number;
  rowsDuplicate?: number;
  nextAttemptAt?: string;
  historyGap?: boolean;
  balanceLimited?: boolean;
};

function isRateLimit(error: unknown): boolean {
  return error instanceof Error && /ASPSP_RATE_LIMIT_EXCEEDED|consented multiplicity per day/i.test(error.message);
}

/** Called by cron and by an authenticated admin. The DB lease and backoff are shared by every process. */
export async function syncMontepio(options: { manual?: boolean; psu?: PsuContext } = {}): Promise<BankSyncResult> {
  const manual = !!options.manual;
  const accountUid = process.env.ENABLE_BANKING_ACCOUNT_UID;
  const sessionId = process.env.ENABLE_BANKING_SESSION_ID;
  if (!bankLiveConfigured() || !accountUid || !sessionId) return { status: 'not_configured' };

  const account = await getMontepioAccount();
  if (!account) return { status: 'not_ready' };

  const { data: claimData, error: claimError } = await db().rpc('ledger_claim_bank_sync', {
    p_account_id: account.id,
    p_account_uid: accountUid,
    p_session_id: sessionId,
    p_valid_until: process.env.ENABLE_BANKING_VALID_UNTIL || null,
    p_manual: manual,
  });
  if (claimError) throw new Error(`Não foi possível reservar a sincronização: ${claimError.message}`);
  const claim = claimData as Claim;
  if (!claim.acquired) return { status: claim.expired ? 'expired' : claim.manualBlocked ? 'rate_limited' : 'waiting', nextAttemptAt: claim.nextAttemptAt };
  if (!claim.leaseToken || !claim.dateFrom) throw new Error('Reserva de sincronização incompleta.');

  let balance: number | null = null;
  let balanceLimited = false;
  let success = false;
  let rateLimited = false;
  let errorCode: string | null = null;
  let rowsNew = 0;
  let rowsDuplicate = 0;

  try {
    const [transactions, rules] = await Promise.all([
      fetchTransactions(accountUid, claim.dateFrom, undefined, options.psu),
      loadCustomRules(),
    ]);
    if (claim.fetchBalance) {
      try {
        const data = await fetchBalances(accountUid, options.psu);
        const booked = data.balances?.find(item => item.balance_type === 'CLBD') || data.balances?.[0];
        const parsed = booked ? Number(booked.balance_amount.amount) : null;
        if (parsed !== null && Number.isFinite(parsed)) balance = parsed;
      } catch (error) {
        balanceLimited = isRateLimit(error);
        // Movements remain useful if only /balances fails.
      }
    }

    const occurrences = new Map<string, number>();
    const rows = transactions
      .map(toStatementLine)
      .filter(line => line.booked && /^\d{4}-\d{2}-\d{2}$/.test(line.bookingDate)
        && Number.isFinite(line.amount) && line.amount !== 0)
      .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate)
        || a.amount - b.amount || a.description.localeCompare(b.description))
      .map(line => {
        const key = line.providerTxId || JSON.stringify([
          line.bookingDate, line.valueDate, line.amount, line.description, line.counterpartyName,
        ]);
        const occurrence = occurrences.get(key) || 0;
        occurrences.set(key, occurrence + 1);
        const fingerprint = createHash('sha256')
          .update(`enable-banking|${account.id}|${key}|${line.providerTxId ? 0 : occurrence}`)
          .digest('hex');
        const category = classifyMovement(line.description, line.amount, rules);
        return {
          booking_date: line.bookingDate,
          value_date: line.valueDate,
          amount: line.amount.toFixed(2),
          description_raw: line.description,
          balance_after: line.balanceAfter?.toFixed(2) ?? null,
          provider_tx_id: line.providerTxId,
          fingerprint,
          match_key: movementMatchKey(line.description),
          parsed_kind: category.kind,
          counterparty_name: category.counterpartyName || line.counterpartyName,
          category_code: category.categoryCode,
          status: category.categoryCode ? 'suggested' : 'unreviewed',
          needs_document: category.needsDocument,
          raw: { suggested_category: category.suggestedCategoryCode, source: 'enable_banking' },
        };
      });

    const { data: imported, error: importError } = await db().rpc('ledger_import_statement', {
      p_batch: {
        account_id: account.id,
        source: 'enable_banking',
        file_name: null,
        file_sha256: null,
        imported_by: 'bank-sync',
        period_from: claim.dateFrom,
        period_to: new Date().toISOString().slice(0, 10),
        balance_ok: null,
        warnings: claim.historyGap ? ['A ligação esteve sem sincronizar mais de 89 dias; pode faltar histórico.'] : [],
      },
      p_rows: rows,
    });
    if (importError) {
      errorCode = 'IMPORT_FAILED';
      throw importError;
    }
    rowsNew = Number(imported?.rows_new || 0);
    rowsDuplicate = Number(imported?.rows_duplicate || 0);
    success = true;
  } catch (error) {
    rateLimited = isRateLimit(error);
    errorCode ||= rateLimited ? 'ASPSP_RATE_LIMIT_EXCEEDED' : 'FETCH_FAILED';
  }

  const { data: finished, error: finishError } = await db().rpc('ledger_finish_bank_sync', {
    p_account_id: account.id,
    p_lease_token: claim.leaseToken,
    p_success: success,
    p_rate_limited: rateLimited,
    p_balance_rate_limited: balanceLimited,
    p_balance: balance,
    p_error_code: errorCode,
    p_manual: manual,
  });
  if (finishError || !finished) throw new Error('Não foi possível guardar o estado da sincronização.');

  return {
    status: success ? 'synced' : rateLimited ? 'rate_limited' : 'failed',
    rowsNew, rowsDuplicate, historyGap: claim.historyGap, balanceLimited,
  };
}
