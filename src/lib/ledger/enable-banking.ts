import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Minimal Enable Banking client (Account Information, restricted mode).
 * Docs: https://enablebanking.com/docs/api/reference/
 *
 * Env:
 *   ENABLE_BANKING_APP_ID          application id (kid of the JWT)
 *   ENABLE_BANKING_PRIVATE_KEY_B64 the .pem, base64 encoded (Railway)
 *   ENABLE_BANKING_PRIVATE_KEY_PATH path to the .pem (local, outside the repo)
 */

const API = 'https://api.enablebanking.com';

/**
 * Must be one of the redirect URLs registered on the Enable Banking app.
 * Until /api/admin/bank/callback is deployed, use a page that exists and keeps
 * the query string (e.g. https://apostoladodegarabandal.com/privacidade) via
 * ENABLE_BANKING_REDIRECT_URL, and paste the resulting address in the script.
 */
export const ENABLE_BANKING_REDIRECT_URL =
  process.env.ENABLE_BANKING_REDIRECT_URL || 'https://apostoladodegarabandal.com/api/admin/bank/callback';

function privateKey(): string {
  const b64 = process.env.ENABLE_BANKING_PRIVATE_KEY_B64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf8');
  const path = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH;
  if (path) return readFileSync(path, 'utf8');
  throw new Error('Falta a chave privada do Enable Banking (ENABLE_BANKING_PRIVATE_KEY_B64 ou ENABLE_BANKING_PRIVATE_KEY_PATH).');
}

function appId(): string {
  const id = process.env.ENABLE_BANKING_APP_ID;
  if (!id) throw new Error('Falta ENABLE_BANKING_APP_ID.');
  return id;
}

const b64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/** RS256 JWT, valid for one hour (the API accepts up to 24h). */
export function enableBankingJwt(now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId() }));
  const payload = b64url(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey()).toString('base64url')}`;
}

/**
 * Account holder present: the admin's IP and browser. Banks do not count these
 * reads against the PSD2 limit of ~4 unattended reads per day.
 */
export type PsuContext = { ipAddress: string; userAgent?: string | null };

function psuHeaders(psu?: PsuContext): Record<string, string> {
  if (!psu?.ipAddress) return {};
  return {
    'Psu-Ip-Address': psu.ipAddress,
    ...(psu.userAgent ? { 'Psu-User-Agent': psu.userAgent.slice(0, 400) } : {}),
  };
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, psu?: PsuContext): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${enableBankingJwt()}`, 'Content-Type': 'application/json', ...psuHeaders(psu) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Enable Banking ${method} ${path} → ${response.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export type Aspsp = { name: string; country: string; psu_types?: string[] };

export async function listAspsps(country = 'PT'): Promise<Aspsp[]> {
  const data = await call<{ aspsps: Aspsp[] }>('GET', `/aspsps?country=${country}`);
  return data.aspsps || [];
}

export async function findMontepio(): Promise<Aspsp> {
  const banks = await listAspsps('PT');
  const bank = banks.find(b => /montepio/i.test(b.name));
  if (!bank) throw new Error(`Montepio não aparece na lista de bancos PT (${banks.length} bancos).`);
  return bank;
}

export async function startAuthorization(options: { aspsp: Aspsp; psuType: 'business' | 'personal'; state: string; days?: number }) {
  const validUntil = new Date(Date.now() + (options.days ?? 180) * 86400000).toISOString();
  return call<{ url: string; authorization_id: string }>('POST', '/auth', {
    access: { valid_until: validUntil },
    aspsp: { name: options.aspsp.name, country: options.aspsp.country },
    state: options.state,
    redirect_url: ENABLE_BANKING_REDIRECT_URL,
    psu_type: options.psuType,
  });
}

export type EbAccount = {
  uid: string;
  account_id?: { iban?: string };
  currency?: string;
  name?: string;
};

export type EbSession = {
  session_id: string;
  accounts: EbAccount[];
  aspsp: { name: string; country: string };
  access: { valid_until: string };
};

export function createSession(code: string) {
  return call<EbSession>('POST', '/sessions', { code });
}

/** GET /sessions/{id}: status and the account uids of an existing session. */
export function getSession(sessionId: string) {
  return call<{ status?: string; accounts?: string[]; access?: { valid_until?: string } }>('GET', `/sessions/${sessionId}`);
}

export type EbTransaction = {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: { currency: string; amount: string };
  credit_debit_indicator: 'CRDT' | 'DBIT';
  status?: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  remittance_information?: string[] | null;
  debtor?: { name?: string | null } | null;
  creditor?: { name?: string | null } | null;
  balance_after_transaction?: { currency: string; amount: string } | null;
  note?: string | null;
  bank_transaction_code?: { description?: string | null } | null;
};

export async function fetchTransactions(accountUid: string, dateFrom: string, dateTo?: string, psu?: PsuContext): Promise<EbTransaction[]> {
  const all: EbTransaction[] = [];
  let continuation: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ date_from: dateFrom });
    if (dateTo) params.set('date_to', dateTo);
    if (continuation) params.set('continuation_key', continuation);
    const data: { transactions: EbTransaction[]; continuation_key?: string | null } =
      await call('GET', `/accounts/${accountUid}/transactions?${params}`, undefined, psu);
    all.push(...(data.transactions || []));
    continuation = data.continuation_key || null;
    if (!continuation) break;
    if (page === 49) throw new Error('Enable Banking devolveu mais de 50 páginas; a leitura foi interrompida para evitar uma importação incompleta.');
  }
  return all;
}

export function fetchBalances(accountUid: string, psu?: PsuContext) {
  return call<{ balances: { name?: string; balance_type: string; balance_amount: { amount: string; currency: string }; reference_date?: string }[] }>(
    'GET', `/accounts/${accountUid}/balances`, undefined, psu,
  );
}

/** Bank API transaction → the same shape the statement file parser produces. */
export function toStatementLine(tx: EbTransaction) {
  const amount = Math.round(Number(tx.transaction_amount.amount) * 100) / 100 * (tx.credit_debit_indicator === 'DBIT' ? -1 : 1);
  const counterparty = tx.credit_debit_indicator === 'CRDT' ? tx.debtor?.name : tx.creditor?.name;
  const description = [
    ...(tx.remittance_information || []),
  ].join(' ').replace(/\s+/g, ' ').trim()
    || tx.bank_transaction_code?.description
    || counterparty
    || tx.note
    || 'Movimento';
  const balance = tx.balance_after_transaction ? Number(tx.balance_after_transaction.amount) : null;
  return {
    providerTxId: tx.entry_reference || tx.transaction_id || null,
    bookingDate: (tx.booking_date || tx.value_date || tx.transaction_date || '').slice(0, 10),
    valueDate: tx.value_date ? tx.value_date.slice(0, 10) : null,
    amount,
    description,
    counterpartyName: counterparty?.trim() || null,
    balanceAfter: balance !== null && Number.isFinite(balance) ? balance : null,
    booked: !tx.status || tx.status === 'BOOK',
  };
}
