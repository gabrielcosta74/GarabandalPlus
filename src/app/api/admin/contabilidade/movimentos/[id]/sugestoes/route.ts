import { addDays, samePerson } from '../../../../../../../lib/ledger/invoice-safety';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Suggestion = {
  pilgrimageId: string;
  pilgrimageTitle: string;
  bookingId: string;
  holderName: string | null;
  pilgrims: string[];
  paymentId: string | null;
  paymentStatus: string | null;
  confidence: 'certain' | 'likely' | 'possible';
  reason: string;
};

type BookingRow = {
  id: string; user_id: string | null; status: string | null; total_amount: number | null; paid_amount: number | null;
  pilgrimage_id: string; pilgrims: { full_name: string }[] | null; pilgrimages: { title: string | null } | { title: string | null }[] | null;
};

const titleOf = (row: BookingRow) => (Array.isArray(row.pilgrimages) ? row.pilgrimages[0]?.title : row.pilgrimages?.title) || 'Peregrinação';
const bookingOf = (value: unknown): BookingRow | null => (Array.isArray(value) ? value[0] : value) as BookingRow | null;

const PAID = ['verified', 'manual', 'succeeded', 'paid'];
const PENDING = ['pending', 'pending_verification', 'verifying'];

/**
 * Read only. Which booking does this incoming transfer most likely pay?
 *  - certain:  a bank-transfer payment with the exact amount AND the payer's name matches
 *  - likely:   the only bank-transfer payment with the exact amount around that date
 *  - possible: the payer's name matches a booking that still owes at least this amount
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Movimento inválido.' }, { status: 400 });

  try {
    const { data: movement, error: movementError } = await db().from('bank_transactions')
      .select('id, amount, booking_date, counterparty_name').eq('id', id).maybeSingle();
    if (movementError) throw movementError;
    if (!movement || Number(movement.amount) <= 0) return Response.json({ suggestions: [] });
    const amount = Number(movement.amount);
    const payer = movement.counterparty_name as string | null;

    // Payments already tied to another bank movement are taken.
    const { data: links, error: linksError } = await db().from('bank_transaction_links')
      .select('target_id').eq('target_type', 'pilgrimage_payment');
    if (linksError) throw linksError;
    const taken = new Set((links || []).map(link => String(link.target_id)));

    const { data: payments, error: paymentsError } = await db().from('pilgrimage_payments')
      .select('id, status, created_at, verified_at, booking_id, bookings(id, user_id, status, total_amount, paid_amount, pilgrimage_id, pilgrims(full_name), pilgrimages(title))')
      .eq('method', 'bank_transfer').eq('amount', amount).eq('deleted', false)
      .gte('created_at', addDays(movement.booking_date, -45))
      .lte('created_at', addDays(movement.booking_date, 45))
      .limit(50);
    if (paymentsError) throw paymentsError;

    const { data: bookings, error: bookingsError } = await db().from('bookings')
      .select('id, user_id, status, total_amount, paid_amount, pilgrimage_id, pilgrims(full_name), pilgrimages!inner(title, start_date)')
      .gte('pilgrimages.start_date', addDays(movement.booking_date, -30))
      .limit(2000);
    if (bookingsError) throw bookingsError;

    const userIds = [...new Set([
      ...(payments || []).map(p => bookingOf(p.bookings)?.user_id),
      ...(bookings || []).map(b => b.user_id),
    ].filter(Boolean))];
    const { data: members, error: membersError } = userIds.length
      ? await db().from('membros').select('id, nome').in('id', userIds)
      : { data: [], error: null };
    if (membersError) throw membersError;
    const memberName = new Map((members || []).map(m => [m.id, m.nome as string | null]));

    const nameMatches = (holder: string | null, pilgrims: string[]) =>
      !!payer && [holder, ...pilgrims].some(name => samePerson(payer, name || null));

    const suggestions: Suggestion[] = [];
    const seenBookings = new Set<string>();
    const paymentRows = (payments || []).filter(p => !taken.has(String(p.id)) && (PAID.includes(p.status) || PENDING.includes(p.status)));
    for (const payment of paymentRows) {
      const booking = bookingOf(payment.bookings);
      if (!booking || ['canceled', 'cancelled'].includes(String(booking.status).toLowerCase())) continue;
      const pilgrims = (booking.pilgrims || []).map((p: { full_name: string }) => p.full_name);
      const holder = (booking.user_id && memberName.get(booking.user_id)) || pilgrims[0] || null;
      const named = nameMatches(holder, pilgrims);
      const confidence = named ? 'certain' : paymentRows.length === 1 ? 'likely' : 'possible';
      suggestions.push({
        pilgrimageId: booking.pilgrimage_id,
        pilgrimageTitle: titleOf(booking),
        bookingId: booking.id,
        holderName: holder,
        pilgrims,
        paymentId: payment.id,
        paymentStatus: payment.status,
        confidence,
        reason: [
          PAID.includes(payment.status) ? 'pagamento já registado na peregrinação' : 'transferência pendente na reserva',
          'mesmo valor',
          named ? 'nome do pagador coincide' : 'pagador diferente',
        ].join(' · '),
      });
      seenBookings.add(booking.id);
    }

    for (const booking of bookings || []) {
      if (seenBookings.has(booking.id) || ['canceled', 'cancelled'].includes(String(booking.status).toLowerCase())) continue;
      const owes = Number(booking.total_amount || 0) - Number(booking.paid_amount || 0);
      if (owes + 0.01 < amount) continue;
      const pilgrims = (booking.pilgrims || []).map((p: { full_name: string }) => p.full_name);
      const holder = (booking.user_id && memberName.get(booking.user_id)) || pilgrims[0] || null;
      if (!nameMatches(holder, pilgrims)) continue;
      suggestions.push({
        pilgrimageId: booking.pilgrimage_id,
        pilgrimageTitle: titleOf(booking as unknown as BookingRow),
        bookingId: booking.id,
        holderName: holder,
        pilgrims,
        paymentId: null,
        paymentStatus: null,
        confidence: 'possible',
        reason: 'nome do pagador coincide · reserva com saldo em dívida',
      });
    }

    const rank = { certain: 0, likely: 1, possible: 2 } as const;
    suggestions.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
    return Response.json({ suggestions: suggestions.slice(0, 5) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível sugerir reservas.';
    return Response.json({ error: message }, { status: 500 });
  }
}
