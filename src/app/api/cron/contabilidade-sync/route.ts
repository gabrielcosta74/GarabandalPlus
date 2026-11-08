import { timingSafeEqual } from 'node:crypto';

import { syncMontepio } from '../../../../lib/ledger/bank-sync';
import { runLedgerFollowUps } from '../../../../lib/ledger/follow-ups';
import { runMailInvoices } from '../../../../lib/ledger/mail-invoices';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Sem acesso.' }, { status: 401 });
  try {
    const result = await syncMontepio();
    // Match incoming transfers to the invoices even when the bank was not read.
    const { enriched, mirror, learned } = await runLedgerFollowUps();
    // Os débitos novos recebem as faturas das subscrições que já chegaram por email.
    const invoices = await runMailInvoices();
    const status = result.status === 'rate_limited' ? 429
      : result.status === 'failed' ? 502
        : result.status === 'not_configured' || result.status === 'not_ready' || result.status === 'expired' ? 503 : 200;
    return Response.json({ ...result, enriched, mirror, learned, invoices }, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'A sincronização do banco falhou.' }, { status: 500 });
  }
}
