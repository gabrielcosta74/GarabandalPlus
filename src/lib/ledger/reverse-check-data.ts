import 'server-only';

import { addDays } from './invoice-safety';
import { checkPaymentsAgainstBank, type CheckedPayment } from './reverse-check';
import { db } from './server';

const PAID = ['verified', 'manual', 'succeeded', 'paid'];

export type MissingPayment = {
  id: string;
  kind: 'pilgrimage' | 'donation';
  amount: number;
  paidOn: string;
  label: string;
  href: string;
};

export type ReverseCheck = {
  bankReadUntil: string | null;
  checked: number;
  linked: number;
  candidates: number;
  waiting: number;
  missing: MissingPayment[];
};

type PaymentRow = {
  id: string; amount: number; verified_at: string | null; created_at: string;
  bookings: { pilgrimage_id: string; pilgrimages: { title: string | null } | null; pilgrims: { full_name: string }[] | null } | null;
};

const EMPTY: ReverseCheck = { bankReadUntil: null, checked: 0, linked: 0, candidates: 0, waiting: 0, missing: [] };

/** Read only. Which bank-transfer payments marked as paid have no money behind them? */
export async function loadReverseCheck(): Promise<ReverseCheck> {
  const [{ data: first, error: firstError }, { data: last, error: lastError }] = await Promise.all([
    db().from('bank_transactions').select('booking_date').order('booking_date', { ascending: true }).limit(1).maybeSingle(),
    db().from('bank_transactions').select('booking_date').order('booking_date', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (firstError || lastError) throw firstError || lastError;
  if (!first || !last) return EMPTY;
  // Before the first bank line we cannot know, so those payments are not judged.
  const coveredFrom = addDays(first.booking_date, 2);

  const [{ data: payments, error: paymentError }, { data: donations, error: donationError }, { data: links, error: linkError }, { data: incoming, error: incomingError }] = await Promise.all([
    db().from('pilgrimage_payments')
      .select('id, amount, verified_at, created_at, bookings(pilgrimage_id, pilgrimages(title), pilgrims(full_name))')
      .eq('method', 'bank_transfer').eq('deleted', false).in('status', PAID)
      .or(`verified_at.gte.${coveredFrom},and(verified_at.is.null,created_at.gte.${coveredFrom})`),
    db().from('donations').select('id, amount_cents, donor_name, reviewed_at, created_at')
      .eq('method', 'bank_transfer').eq('status', 'succeeded').gte('created_at', coveredFrom),
    db().from('bank_transaction_links').select('bank_transaction_id, target_type, target_id'),
    db().from('bank_transactions').select('id, amount, booking_date')
      .eq('parsed_kind', 'incoming_transfer').neq('status', 'ignored'),
  ]);
  const failure = paymentError || donationError || linkError || incomingError;
  if (failure) throw failure;

  const linkedTargets = new Set((links || []).map(link => `${link.target_type}:${link.target_id}`));
  // A movement already tied to something else cannot also justify this payment.
  const usedMovements = new Set((links || []).map(link => link.bank_transaction_id as string));

  const details = new Map<string, MissingPayment>();
  const checked: CheckedPayment[] = [];
  for (const payment of (payments || []) as unknown as PaymentRow[]) {
    const paidOn = String(payment.verified_at || payment.created_at).slice(0, 10);
    const booking = payment.bookings;
    checked.push({ id: payment.id, amount: Number(payment.amount), paidOn, linked: linkedTargets.has(`pilgrimage_payment:${payment.id}`) });
    details.set(payment.id, {
      id: payment.id, kind: 'pilgrimage', amount: Number(payment.amount), paidOn,
      label: [booking?.pilgrimages?.title, booking?.pilgrims?.[0]?.full_name].filter(Boolean).join(' · ') || 'Pagamento de peregrinação',
      href: booking?.pilgrimage_id ? `/admin/peregrinacoes/${booking.pilgrimage_id}` : '/admin/peregrinacoes',
    });
  }
  for (const donation of donations || []) {
    const paidOn = String(donation.reviewed_at || donation.created_at).slice(0, 10);
    const amount = Number(donation.amount_cents) / 100;
    checked.push({ id: donation.id, amount, paidOn, linked: linkedTargets.has(`donation:${donation.id}`) });
    details.set(donation.id, { id: donation.id, kind: 'donation', amount, paidOn, label: donation.donor_name || 'Doação', href: '/admin/doacoes' });
  }

  const available = (incoming || [])
    .filter(movement => !usedMovements.has(movement.id))
    .map(movement => ({ id: movement.id, amount: Number(movement.amount), bookingDate: movement.booking_date as string }));
  const states = checkPaymentsAgainstBank(checked, available, last.booking_date);

  const count = (state: string) => [...states.values()].filter(value => value === state).length;
  return {
    bankReadUntil: last.booking_date,
    checked: checked.length,
    linked: count('linked'),
    candidates: count('candidate'),
    waiting: count('waiting'),
    missing: [...states.entries()]
      .filter(([, state]) => state === 'missing')
      .map(([id]) => details.get(id) as MissingPayment)
      .sort((a, b) => a.paidOn.localeCompare(b.paidOn)),
  };
}
