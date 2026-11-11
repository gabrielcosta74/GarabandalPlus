import { rankPaymentsForAgreement } from '../../../../../../../lib/ledger/agreement-rules';
import { listAgreements } from '../../../../../../../lib/ledger/agreements';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Read only. Bank debits that could pay this agreement, best first, so the
 * hotel screen can tie a payment without going through the movement list.
 * Leaves out debits already tied to an agreement, ignored ones and closed months.
 */
export async function GET(req: Request, context: { params: Promise<{ agreementId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { agreementId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(agreementId)) return Response.json({ error: 'Acordo inválido.' }, { status: 400 });
  try {
    const [agreement] = (await listAgreements({ ids: [agreementId] })) || [];
    if (!agreement) return Response.json({ error: 'Acordo não encontrado.' }, { status: 404 });
    if (agreement.status !== 'open' || agreement.remaining <= 0) return Response.json({ candidates: [] });

    const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    const [movements, linked, closed] = await Promise.all([
      db().from('bank_transactions')
        .select('id, booking_date, amount, description_raw, counterparty_name, status, period')
        .lt('amount', 0).neq('status', 'ignored').gte('booking_date', since)
        .order('booking_date', { ascending: false }).limit(800),
      db().from('bank_transaction_links').select('bank_transaction_id').eq('target_type', 'agreement').limit(50000),
      db().from('ledger_periods').select('period').eq('status', 'closed'),
    ]);
    for (const result of [movements, linked]) if (result.error) throw result.error;
    const taken = new Set((linked.data || []).map(row => String(row.bank_transaction_id)));
    const closedPeriods = new Set((closed.error ? [] : closed.data || []).map(row => String(row.period)));

    const candidates = rankPaymentsForAgreement(agreement, (movements.data || [])
      .filter(row => !taken.has(String(row.id)) && !closedPeriods.has(String(row.period)))
      .map(row => ({
        id: String(row.id),
        bookingDate: String(row.booking_date),
        amount: Number(row.amount),
        description: String(row.description_raw || ''),
        counterparty: (row.counterparty_name as string | null) || null,
      })));
    return Response.json({ candidates: candidates.slice(0, 12) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler o banco.' }, { status: 500 });
  }
}
