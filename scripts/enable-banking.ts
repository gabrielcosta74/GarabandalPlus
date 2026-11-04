/**
 * Enable Banking — ligação ao Montepio a partir do terminal.
 *
 *   npx tsx --env-file=.env.local scripts/enable-banking.ts connect
 *   npx tsx --env-file=.env.local scripts/enable-banking.ts fetch 2026-10-01
 *
 * Needs ENABLE_BANKING_APP_ID and ENABLE_BANKING_PRIVATE_KEY_PATH (or _B64).
 * `connect` prints the bank authorisation link; after authorising, paste the
 * URL the browser lands on (it may show a 404 — the code is in the URL).
 * Read-only: nothing is written to the database.
 */
import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';

import { classifyMovement } from '../src/lib/ledger/classify';
import {
  createSession,
  getSession,
  fetchBalances,
  fetchTransactions,
  findMontepio,
  startAuthorization,
  toStatementLine,
} from '../src/lib/ledger/enable-banking';

async function connect(psuType: 'business' | 'personal') {
  const bank = await findMontepio();
  console.log(`Banco: ${bank.name} (${bank.country}) · tipo: ${psuType}`);
  const state = randomUUID();
  const auth = await startAuthorization({ aspsp: bank, psuType, state });
  console.log('\n1) Abra este link e autorize no Montepio:\n');
  console.log(auth.url);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = (await rl.question('\n2) Cole aqui o endereço completo para onde o browser foi enviado:\n> ')).trim();
  rl.close();
  const url = new URL(pasted);
  if (url.searchParams.get('error')) throw new Error(`O banco devolveu erro: ${url.searchParams.get('error')} ${url.searchParams.get('error_description') || ''}`);
  if (url.searchParams.get('state') !== state) throw new Error('O "state" não corresponde a este pedido. Comece de novo.');
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Não encontrei "code" no endereço.');
  const session = await createSession(code);
  console.log(`\nLigação criada. Válida até ${session.access.valid_until}.`);
  session.accounts.forEach(a => console.log(`  conta ${a.account_id?.iban || '?'} · uid ${a.uid}`));
  const account = session.accounts[0];
  console.log('\n3) Acrescente ao .env.local (e às variáveis do Railway):\n');
  console.log(`ENABLE_BANKING_SESSION_ID=${session.session_id}`);
  if (account) console.log(`ENABLE_BANKING_ACCOUNT_UID=${account.uid}`);
}

async function fetchAndShow(dateFrom: string) {
  const uid = process.env.ENABLE_BANKING_ACCOUNT_UID;
  if (!uid) throw new Error('Falta ENABLE_BANKING_ACCOUNT_UID (corra primeiro "connect").');
  const balances = await fetchBalances(uid);
  balances.balances.forEach(b => console.log(`Saldo ${b.balance_type}: ${b.balance_amount.amount} ${b.balance_amount.currency}`));
  const txs = await fetchTransactions(uid, dateFrom);
  const lines = txs.map(toStatementLine).filter(l => l.booked);
  console.log(`\n${lines.length} movimentos desde ${dateFrom}:\n`);
  lines.slice(0, 40).forEach(l => {
    const c = classifyMovement(l.description, l.amount);
    console.log(`${l.bookingDate}  ${l.amount.toFixed(2).padStart(10)}  ${(c.categoryCode || c.suggestedCategoryCode || '?').padEnd(20)}  ${l.description.slice(0, 50)}`);
  });
  if (txs[0]) console.log('\nExemplo do formato bruto (1.º movimento):\n', JSON.stringify(txs[0], null, 2));
}

async function showSession() {
  const id = process.env.ENABLE_BANKING_SESSION_ID;
  if (!id) throw new Error('Falta ENABLE_BANKING_SESSION_ID.');
  const session = await getSession(id);
  console.log(`Sessão ${session.status || ''} · válida até ${session.access?.valid_until || '?'}`);
  for (const uid of session.accounts || []) console.log(`ENABLE_BANKING_ACCOUNT_UID=${uid}`);
}

const [command, arg] = process.argv.slice(2);
const run = command === 'session'
  ? showSession()
  : command === 'connect'
  ? connect(arg === 'personal' ? 'personal' : 'business')
  : command === 'fetch'
    ? fetchAndShow(arg || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    : Promise.reject(new Error('Use: connect [business|personal] | fetch AAAA-MM-DD'));

run.catch(error => {
  console.error(`\nErro: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
