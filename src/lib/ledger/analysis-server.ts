import 'server-only';

import {
  buildAnalysis,
  FLOW_WINDOW_DAYS,
  addDays,
  type Analysis,
  type AnalysisMovement,
  type AnalysisTripInput,
  type HistoryDay,
} from './analysis';
import { db, getMontepioAccount, isMissingTableError } from './server';
import { costTotalOf, getPilgrimageAccounts, stayCostOf } from '../logistics-accounts';

const PAGE = 1000;
const PAID_PAYMENT = ['verified', 'succeeded', 'paid', 'manual'];

/** PostgREST caps each response, so long tables are read in pages. */
async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function loadMovements(): Promise<AnalysisMovement[]> {
  const rows = await readAll<{ booking_date: string; amount: number | string; category_code: string | null }>((from, to) =>
    db().from('bank_transactions')
      .select('id, booking_date, amount, category_code')
      .order('booking_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to));
  return rows.map(row => ({ date: row.booking_date, amount: Number(row.amount), category: row.category_code }));
}

/** Spreadsheet history is optional: without it the page simply starts at the first bank day. */
async function loadHistory(): Promise<HistoryDay[]> {
  try {
    const rows = await readAll<{ day: string; inflow: number | string; outflow: number | string; closing_balance: number | string }>((from, to) =>
      db().from('bank_history_daily')
        .select('day, inflow, outflow, closing_balance')
        .order('day', { ascending: true })
        .range(from, to));
    return rows.map(row => ({
      day: row.day,
      inflow: Number(row.inflow),
      outflow: Number(row.outflow),
      closing: Number(row.closing_balance),
    }));
  } catch (error) {
    if (isMissingTableError(error as { code?: string; message?: string })) return [];
    throw error;
  }
}

async function loadBalance() {
  const account = await getMontepioAccount();
  if (!account) return { balance: null, syncedAt: null };
  const { data, error } = await db().from('bank_connections')
    .select('last_balance, last_synced_at')
    .eq('account_id', account.id)
    .maybeSingle();
  if (error) throw error;
  return {
    balance: data?.last_balance === null || data?.last_balance === undefined ? null : Number(data.last_balance),
    syncedAt: (data?.last_synced_at as string | null) ?? null,
  };
}

async function loadTrips(today: string): Promise<AnalysisTripInput[]> {
  const { data: pilgrimages, error } = await db().from('pilgrimages')
    .select('id, title, start_date, end_date')
    .gte('end_date', today)
    .order('start_date', { ascending: true });
  if (error) throw error;
  // Internal test and store-review trips have a bracketed title.
  const real = (pilgrimages || []).filter(trip => !String(trip.title || '').trim().startsWith('['));
  return Promise.all(real.map(async trip => {
    // The same read-only calculation powers Logística → Contas: room mix,
    // complimentary rooms, restaurants per person and paid supplier amounts.
    const accounts = await getPilgrimageAccounts(db(), trip.id as string);
    const confirmed = accounts.people.filter(person => person.kind === 'pilgrim' && person.bookingStatus === 'confirmed');
    const totalDue = confirmed.reduce((total, person) => total + person.totalAmount, 0);
    const paid = confirmed.reduce((total, person) => total + person.paidAmount, 0);
    const costLines = [
      ...accounts.stays.map(stay => ({
        amount: stayCostOf(stay, accounts.roomMix).total,
        paid: stay.paidAmount,
        dueDate: stay.dueDate,
      })),
      ...accounts.costs.filter(cost => cost.kind !== 'flight').map(cost => ({
        amount: costTotalOf(cost, accounts.revenue.beds),
        paid: cost.paidAmount,
        dueDate: cost.dueDate,
      })),
    ];
    return {
      id: trip.id as string,
      title: String(trip.title),
      start: String(trip.start_date).slice(0, 10),
      end: String(trip.end_date).slice(0, 10),
      totalDue,
      paid,
      pendingBookingValue: Math.max(accounts.revenue.expected - totalDue, 0),
      knownCost: accounts.expenses.total,
      knownCostPaid: accounts.expenses.paid,
      hotelCost: accounts.hotels.total,
      costLines,
    };
  }));
}

async function loadQuotaRenewals(today: string) {
  const rows = await readAll<{ proxima_quota: string | null; data_expiracao: string | null }>((from, to) =>
    db().from('membros')
      .select('id, proxima_quota, data_expiracao')
      .eq('estado_quota', 'pago')
      .order('id', { ascending: true })
      .range(from, to));
  const byMonth = new Map<string, number>();
  rows.forEach(row => {
    const due = row.proxima_quota || row.data_expiracao;
    if (!due || due < today) return;
    const month = due.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + 1);
  });
  return [...byMonth].map(([month, count]) => ({ month, count }));
}

async function loadCardPayments(today: string) {
  const from = addDays(today, -(FLOW_WINDOW_DAYS - 1));
  const [pilgrimage, donation, quota, store] = await Promise.all([
    db().from('pilgrimage_payments').select('amount, deleted')
      .ilike('method', 'reduniq%').in('status', PAID_PAYMENT).gte('created_at', from).limit(PAGE * 5),
    db().from('donations').select('amount_cents')
      .eq('status', 'succeeded').eq('method', 'pix').gte('created_at', from).limit(PAGE * 5),
    db().from('pagamentos_quotas').select('valor')
      .eq('estado', 'pago').ilike('metodo_pagamento', 'reduniq%').gte('data_pagamento', from).limit(PAGE * 5),
    db().from('store_orders').select('total_amount')
      .eq('status', 'paid').gte('created_at', from).limit(PAGE * 5),
  ]);
  for (const result of [pilgrimage, donation, quota, store]) if (result.error) throw result.error;
  return {
    pilgrimage: (pilgrimage.data || []).filter(row => !row.deleted).reduce((total, row) => total + Number(row.amount || 0), 0),
    donation: (donation.data || []).reduce((total, row) => total + Number(row.amount_cents || 0) / 100, 0),
    other: (quota.data || []).reduce((total, row) => total + Number(row.valor || 0), 0)
      + (store.data || []).reduce((total, row) => total + Number(row.total_amount || 0), 0),
  };
}

/** Reads from the database only: opening the page never spends the bank's daily limit. */
export async function loadAnalysis(now = new Date()): Promise<Analysis> {
  const today = now.toISOString().slice(0, 10);
  const [movements, history, { balance, syncedAt }, trips, quotaRenewals, cardPayments] = await Promise.all([
    loadMovements(),
    loadHistory(),
    loadBalance(),
    loadTrips(today),
    loadQuotaRenewals(today),
    loadCardPayments(today),
  ]);
  return buildAnalysis({ today, balance, syncedAt, movements, history, trips, quotaRenewals, cardPayments });
}
