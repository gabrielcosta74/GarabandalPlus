import 'server-only';

import { classifyMovement, stripReference } from './classify';
import { fetchBalances, fetchTransactions, getSession, toStatementLine, type EbTransaction } from './enable-banking';
import type { LedgerMovement } from './server';

/*
 * Read-only view of the Montepio account straight from Enable Banking, used
 * while the ledger tables are not live. Nothing is stored; actions on these
 * movements stay in the browser until the import into the database exists.
 */

export function bankLiveConfigured(): boolean {
  return Boolean(
    process.env.ENABLE_BANKING_APP_ID
    && process.env.ENABLE_BANKING_ACCOUNT_UID
    && (process.env.ENABLE_BANKING_PRIVATE_KEY_B64 || process.env.ENABLE_BANKING_PRIVATE_KEY_PATH),
  );
}

export type BankLiveSnapshot = {
  fetchedAt: string;
  nextRefreshAt: string;
  rateLimited: boolean;
  balanceLimited: boolean;
  validUntil: string | null;
  balance: number | null;
  movements: LedgerMovement[];
};

let cache: { key: string; at: number; data: BankLiveSnapshot; raw: EbTransaction[] } | null = null;
let inFlight: { key: string; promise: Promise<BankLiveSnapshot> } | null = null;
let transactionsLimitedUntil = 0;
let balancesLimitedUntil = 0;
// Space snapshot attempts; pagination and other clients may also use the consent.
const CACHE_MS = 6 * 60 * 60 * 1000;
const LIMIT_BACKOFF_MS = 24 * 60 * 60 * 1000;

function cachedSnapshot(): BankLiveSnapshot {
  const current = cache!;
  return {
    ...current.data,
    nextRefreshAt: new Date(Math.max(current.at + CACHE_MS, transactionsLimitedUntil)).toISOString(),
    rateLimited: Date.now() < transactionsLimitedUntil,
    balanceLimited: Date.now() < balancesLimitedUntil || current.data.balanceLimited,
  };
}

function isRateLimit(error: unknown): boolean {
  return error instanceof Error && /ASPSP_RATE_LIMIT_EXCEEDED|consented multiplicity per day/i.test(error.message);
}

function daysBack(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/**
 * Banks only serve ~90 days of history under PSD2 without a fresh strong
 * authentication. Ask for `days` and shrink the window if the bank refuses.
 */
async function fetchWithinBankWindow(uid: string, days: number) {
  for (const window of [days, 60, 30]) {
    try {
      return { transactions: await fetchTransactions(uid, daysBack(window)), dateFrom: daysBack(window) };
    } catch (error) {
      if (!(error instanceof Error) || !/WRONG_TRANSACTIONS_PERIOD|out of bound/i.test(error.message) || window === 30) throw error;
    }
  }
  throw new Error('O banco recusou o período pedido.');
}

/** Movements of the last `days` days (default 89, inside the bank's 90-day limit). */
export async function loadBankLive(options: { days?: number; force?: boolean } = {}): Promise<BankLiveSnapshot> {
  const uid = process.env.ENABLE_BANKING_ACCOUNT_UID as string;
  const days = options.days ?? 89;
  const key = `${uid}:${days}`;
  // A forced browser refresh must not bypass the bank's daily consent limit.
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cachedSnapshot();
  if (Date.now() < transactionsLimitedUntil) {
    if (cache && cache.key === key) return cachedSnapshot();
    throw new Error('O Montepio atingiu o limite diário de consultas. Volte a tentar amanhã ou importe um extrato.');
  }
  if (inFlight?.key === key) return inFlight.promise;

  const pending = fetchBankSnapshot(uid, days, key);
  inFlight = { key, promise: pending };
  try {
    return await pending;
  } finally {
    if (inFlight?.promise === pending) inFlight = null;
  }
}

async function fetchBankSnapshot(uid: string, days: number, key: string): Promise<BankLiveSnapshot> {
  const previous = cache?.key === key ? cache : null;
  const [transactionResult, balanceResult, session] = await Promise.all([
    (previous
      ? fetchTransactions(uid, daysBack(7)).then(transactions => ({ transactions }))
      : fetchWithinBankWindow(uid, days))
      .then(value => ({ value, error: null })).catch(error => ({ value: null, error })),
    (Date.now() < balancesLimitedUntil ? Promise.resolve(null) : fetchBalances(uid))
      .then(value => ({ value, error: null })).catch(error => ({ value: null, error })),
    process.env.ENABLE_BANKING_SESSION_ID
      ? getSession(process.env.ENABLE_BANKING_SESSION_ID).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (isRateLimit(transactionResult.error)) transactionsLimitedUntil = Date.now() + LIMIT_BACKOFF_MS;
  if (isRateLimit(balanceResult.error)) balancesLimitedUntil = Date.now() + LIMIT_BACKOFF_MS;
  if (transactionResult.error) {
    if (cache && cache.key === key && isRateLimit(transactionResult.error)) return cachedSnapshot();
    if (isRateLimit(transactionResult.error)) throw new Error('O Montepio atingiu o limite diário de consultas a movimentos. Volte a tentar amanhã ou importe um extrato.');
    throw transactionResult.error;
  }
  if (balanceResult.error && !isRateLimit(balanceResult.error)) throw balanceResult.error;
  const recentTransactions = transactionResult.value!.transactions;
  const cutoff = daysBack(days);
  const allTransactions = new Map<string, EbTransaction>();
  const merge = (rows: EbTransaction[]) => {
    const occurrences = new Map<string, number>();
    for (const tx of rows) {
      const base = tx.entry_reference || tx.transaction_id
        || JSON.stringify([tx.booking_date, tx.transaction_amount, tx.credit_debit_indicator, tx.remittance_information]);
      const count = occurrences.get(base) || 0;
      occurrences.set(base, count + 1);
      allTransactions.set(`${base}#${count}`, tx);
    }
  };
  merge(previous?.raw || []);
  merge(recentTransactions);
  const transactions = [...allTransactions.values()].filter(tx =>
    (tx.booking_date || tx.value_date || tx.transaction_date || '') >= cutoff,
  );
  const balances = balanceResult.value;

  const booked = balances?.balances.find(b => b.balance_type === 'CLBD') || balances?.balances[0];
  const balance = booked ? Number(booked.balance_amount.amount) : null;

  const lines = transactions.map(toStatementLine).filter(line => line.booked && line.bookingDate);
  // Newest first, so the running balance can be walked backwards from today's.
  lines.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

  let runningCents = balance !== null ? Math.round(balance * 100) : null;
  const seen = new Map<string, number>();
  const movements: LedgerMovement[] = lines.map(line => {
    const balanceAfter = line.balanceAfter ?? (runningCents !== null ? runningCents / 100 : null);
    if (runningCents !== null) runningCents -= Math.round(line.amount * 100);
    const guess = classifyMovement(line.description, line.amount);
    const baseId = line.providerTxId || `${line.bookingDate}:${line.amount}:${line.description}`;
    const n = seen.get(baseId) || 0;
    seen.set(baseId, n + 1);
    return {
      id: n ? `${baseId}#${n}` : baseId,
      period: line.bookingDate.slice(0, 7),
      bookingDate: line.bookingDate,
      valueDate: line.valueDate,
      description: stripReference(line.description),
      amount: line.amount,
      balanceAfter,
      kind: guess.kind,
      categoryCode: guess.categoryCode,
      suggestedCategoryCode: guess.suggestedCategoryCode,
      counterpartyName: guess.counterpartyName || line.counterpartyName,
      needsDocument: guess.needsDocument,
      paperDocument: false,
      documentCount: 0,
      invoiceRefs: [],
      status: guess.categoryCode ? 'suggested' : 'unreviewed',
      ignoreReason: null,
      notes: null,
      reviewedBy: null,
      reviewedAt: null,
    };
  });
  // Oldest first, as the rest of the page expects.
  movements.reverse();

  const data: BankLiveSnapshot = {
    fetchedAt: new Date().toISOString(),
    nextRefreshAt: new Date(Date.now() + CACHE_MS).toISOString(),
    rateLimited: false,
    balanceLimited: Date.now() < balancesLimitedUntil || isRateLimit(balanceResult.error),
    validUntil: session?.access?.valid_until || previous?.data.validUntil || null,
    balance,
    movements,
  };
  cache = { key, at: Date.now(), data, raw: transactions };
  return data;
}
