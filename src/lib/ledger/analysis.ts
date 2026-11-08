/*
 * Pure calculations behind Finanças → Análise. No I/O, so every figure can be
 * tested. The page only reads: nothing here changes money, documents or the ledger.
 */

export type AnalysisMovement = { date: string; amount: number; category: string | null };
export type HistoryDay = { day: string; inflow: number; outflow: number; closing: number };
export type AnalysisTripInput = {
  id: string;
  title: string;
  start: string;
  totalDue: number;
  paid: number;
  /** Supplier costs registered in Logística, and how much of them is already paid. */
  knownCost: number;
  knownCostPaid: number;
};

export type AnalysisInput = {
  today: string;
  balance: number | null;
  syncedAt: string | null;
  movements: AnalysisMovement[];
  history: HistoryDay[];
  trips: AnalysisTripInput[];
  quotaRenewals: { month: string; count: number }[];
  /** Site card payments in the flow window: tells what the Reduniq settlements really were. */
  cardPayments: { pilgrimage: number; donation: number; other: number };
};

export type FlowItem = { key: string; label: string; amount: number; tone: 'in' | 'out' | 'neutral' };

export type ForecastInputs = {
  today: string;
  balance: number;
  donationsMonthly: number;
  fixedMonthly: number;
  tripSpendSoFar: number;
  noise: number;
  quotaValue: number;
  quotaRenewals: { month: string; count: number }[];
  trips: { start: string; totalDue: number; remaining: number; knownCost: number; knownCostPaid: number }[];
};

export type ForecastPoint = { date: string; balance: number; low: number; high: number };

export type Analysis = {
  today: string;
  syncedAt: string | null;
  balance: number | null;
  series: { date: string; balance: number }[];
  sinceDate: string | null;
  sinceDelta: number | null;
  months: { month: string; inflow: number; outflow: number; complete: boolean }[];
  days: { date: string; net: number }[];
  flow: { windowDays: number; total: number; sources: FlowItem[]; destinations: FlowItem[] };
  trips: {
    id: string;
    title: string;
    shortTitle: string;
    start: string;
    daysToStart: number;
    totalDue: number;
    paid: number;
    remaining: number;
    advance: number;
  }[];
  committed: number;
  free: number | null;
  receivable: number;
  pace: { inflow: number; outflow: number; typicalInflow: number | null; elapsed: number; share: number | null };
  fixedMonthly: number;
  runwayMonths: number | null;
  pilgrimageShare: number | null;
  forecast: ForecastInputs | null;
};

export const FLOW_WINDOW_DAYS = 90;
export const QUOTA_VALUE = 25;
const TRIP_CATEGORIES = new Set(['alojamento', 'viagem']);
const NOT_RUNNING_COSTS = new Set(['alojamento', 'viagem', 'devolucao', 'transferencia_interna']);

const round2 = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));
const dayMs = 86400000;
const toMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => toIso(toMs(iso) + days * dayMs);
const monthOf = (iso: string) => iso.slice(0, 7);
const daysInMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
};
const monthIndex = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return year * 12 + (m - 1);
};
const monthFromIndex = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
const monthEnd = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

/** "Peregrinação a Garabandal - Caminho Ibérico - Novembro 2026" → "Caminho Ibérico". */
export function shortTripTitle(title: string): string {
  const parts = title.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[1];
  return parts[0].replace(/^peregrina[çc][ãa]o\s+(a|à|ao)\s+/i, '').replace(/\s+/g, ' ');
}

/**
 * Keeps only real bank lines from the 2026 spreadsheet. Lines without a running
 * balance are the admin's breakdown of a Unicre settlement, so counting them
 * would count the same money twice.
 */
export function historyFromRows(
  rows: { date: string; amount: number | null; balance: number | null }[],
  until: string,
): HistoryDay[] {
  const byDay = new Map<string, HistoryDay>();
  for (const row of rows) {
    if (row.amount === null || row.balance === null || row.date > until) continue;
    const current = byDay.get(row.date) || { day: row.date, inflow: 0, outflow: 0, closing: row.balance };
    if (row.amount > 0) current.inflow = round2(current.inflow + row.amount);
    else current.outflow = round2(current.outflow - row.amount);
    current.closing = row.balance;
    byDay.set(row.date, current);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function buildSeries(input: AnalysisInput, netByDay: Map<string, number>) {
  if (input.balance === null) return [];
  const firstBankDay = [...netByDay.keys()].sort()[0] || input.today;
  const series: { date: string; balance: number }[] = [];
  let balance = input.balance;
  for (let day = input.today; day >= firstBankDay; day = addDays(day, -1)) {
    series.unshift({ date: day, balance: round2(balance) });
    balance -= netByDay.get(day) || 0;
  }
  const history = input.history.filter(row => row.day < firstBankDay).sort((a, b) => a.day.localeCompare(b.day));
  if (!history.length) return series;
  const closes = new Map(history.map(row => [row.day, row.closing]));
  const earlier: { date: string; balance: number }[] = [];
  let last = history[0].closing;
  for (let day = history[0].day; day < firstBankDay; day = addDays(day, 1)) {
    last = closes.get(day) ?? last;
    earlier.push({ date: day, balance: round2(last) });
  }
  return [...earlier, ...series];
}

function buildMonths(input: AnalysisInput, firstCoveredDay: string | null) {
  const map = new Map<string, { month: string; inflow: number; outflow: number }>();
  const add = (month: string, inflow: number, outflow: number) => {
    const row = map.get(month) || { month, inflow: 0, outflow: 0 };
    row.inflow = round2(row.inflow + inflow);
    row.outflow = round2(row.outflow + outflow);
    map.set(month, row);
  };
  const firstBankDay = input.movements.map(row => row.date).sort()[0] || input.today;
  input.history.filter(row => row.day < firstBankDay).forEach(row => add(monthOf(row.day), row.inflow, row.outflow));
  input.movements.forEach(row => add(monthOf(row.date), Math.max(row.amount, 0), Math.max(-row.amount, 0)));
  const currentMonth = monthOf(input.today);
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).map(row => ({
    ...row,
    complete: row.month !== currentMonth && !!firstCoveredDay && firstCoveredDay <= `${row.month}-01`,
  }));
}

function buildFlow(input: AnalysisInput): Analysis['flow'] {
  const from = addDays(input.today, -(FLOW_WINDOW_DAYS - 1));
  const rows = input.movements.filter(row => row.date >= from && row.date <= input.today);
  const inflow = sum(rows.filter(row => row.amount > 0).map(row => row.amount));
  const outflow = sum(rows.filter(row => row.amount < 0).map(row => -row.amount));
  const inBy = (test: (category: string | null) => boolean) =>
    sum(rows.filter(row => row.amount > 0 && test(row.category)).map(row => row.amount));
  const outBy = (test: (category: string | null) => boolean) =>
    sum(rows.filter(row => row.amount < 0 && test(row.category)).map(row => -row.amount));

  const reduniq = inBy(category => category === 'liquidacao_reduniq');
  const { pilgrimage: cardPilgrimage, donation: cardDonation, other: cardOther } = input.cardPayments;
  const cardTotal = cardPilgrimage + cardDonation + cardOther;
  const pilgrimageShare = cardTotal > 0 ? cardPilgrimage / cardTotal : 1;
  const donationShare = cardTotal > 0 ? cardDonation / cardTotal : 0;

  const pilgrimages = round2(inBy(category => category === 'peregrinacao') + reduniq * pilgrimageShare);
  const donations = round2(inBy(category => category === 'doacao') + reduniq * donationShare);
  const unclassifiedIn = inBy(category => category === null);
  const otherIn = round2(inflow - pilgrimages - donations - unclassifiedIn);

  const sources: FlowItem[] = [
    { key: 'pilgrimages', label: 'Peregrinações', amount: pilgrimages, tone: 'in' as const },
    { key: 'donations', label: 'Doações', amount: donations, tone: 'in' as const },
    { key: 'unclassified', label: 'Por classificar', amount: unclassifiedIn, tone: 'neutral' as const },
    { key: 'other', label: 'Loja, quotas e outros', amount: otherIn, tone: 'in' as const },
  ].filter(item => item.amount >= 0.5);

  const hotels = outBy(category => category === 'alojamento');
  const transport = outBy(category => category === 'viagem');
  const taxes = outBy(category => !!category && ['impostos', 'contabilidade', 'imposto_selo'].includes(category));
  const people = outBy(category => !!category && ['remuneracao', 'recibos_verdes'].includes(category));
  const miscellaneous = outBy(category => category === 'outra_despesa');
  const unclassifiedOut = outBy(category => category === null);
  const rest = round2(outflow - hotels - transport - taxes - people - miscellaneous - unclassifiedOut);
  const kept = round2(inflow - outflow);

  const destinations: FlowItem[] = [
    { key: 'hotels', label: 'Hotéis e refeições', amount: hotels, tone: 'out' as const },
    { key: 'kept', label: 'Ficou na conta', amount: Math.max(kept, 0), tone: 'in' as const },
    { key: 'transport', label: 'Transportes', amount: transport, tone: 'out' as const },
    { key: 'misc', label: 'Outras despesas', amount: miscellaneous, tone: 'out' as const },
    { key: 'unclassified', label: 'Por classificar', amount: unclassifiedOut, tone: 'neutral' as const },
    { key: 'people', label: 'Pessoas', amount: people, tone: 'out' as const },
    { key: 'taxes', label: 'Impostos e contabilidade', amount: taxes, tone: 'out' as const },
    { key: 'rest', label: 'Outros', amount: rest, tone: 'out' as const },
  ].filter(item => item.amount >= 0.5);

  // In a month that spends more than it earns the difference comes out of the balance.
  if (kept < 0) sources.push({ key: 'balance', label: 'Do saldo', amount: -kept, tone: 'neutral' });

  return { windowDays: FLOW_WINDOW_DAYS, total: Math.max(inflow, outflow), sources, destinations };
}

export function buildAnalysis(input: AnalysisInput): Analysis {
  const netByDay = new Map<string, number>();
  input.movements.forEach(row => netByDay.set(row.date, round2((netByDay.get(row.date) || 0) + row.amount)));

  const firstBankDay = input.movements.map(row => row.date).sort()[0] || null;
  const historyDays = input.history.filter(row => !firstBankDay || row.day < firstBankDay);
  const firstCoveredDay = historyDays.length
    ? historyDays.map(row => row.day).sort()[0]
    : firstBankDay;

  const series = buildSeries(input, netByDay);
  const year = input.today.slice(0, 4);
  const sinceRow = series.find(row => row.date >= `${year}-01-01`) || series[0] || null;

  const months = buildMonths(input, firstCoveredDay);
  const dayRows = new Map<string, number>();
  historyDays.forEach(row => dayRows.set(row.day, round2(row.inflow - row.outflow)));
  netByDay.forEach((net, day) => dayRows.set(day, net));
  const days = series.map(row => ({ date: row.date, net: dayRows.get(row.date) || 0 }));

  const flow = buildFlow(input);
  const flowIn = sum(flow.sources.filter(item => item.key !== 'balance').map(item => item.amount));
  const pilgrimageFlow = flow.sources.find(item => item.key === 'pilgrimages')?.amount || 0;

  const trips = input.trips
    .filter(trip => trip.start >= input.today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(trip => ({
      id: trip.id,
      title: trip.title,
      shortTitle: shortTripTitle(trip.title),
      start: trip.start,
      daysToStart: Math.round((toMs(trip.start) - toMs(input.today)) / dayMs),
      totalDue: round2(trip.totalDue),
      paid: round2(trip.paid),
      remaining: round2(Math.max(trip.totalDue - trip.paid, 0)),
      advance: round2(Math.max(trip.paid - trip.knownCostPaid, 0)),
    }));
  const committed = sum(trips.map(trip => trip.advance));
  const receivable = sum(trips.map(trip => trip.remaining));
  const free = input.balance === null ? null : round2(input.balance - committed);

  // Running costs and donations come only from whole months read from the bank,
  // where the category is known.
  const currentMonth = monthOf(input.today);
  const bankMonths = [...new Set(input.movements.map(row => monthOf(row.date)))]
    .filter(month => month !== currentMonth && !!firstBankDay && firstBankDay <= `${month}-01`)
    .sort()
    .slice(-3);
  const inBankMonths = input.movements.filter(row => bankMonths.includes(monthOf(row.date)));
  const perMonth = (total: number) => (bankMonths.length ? round2(total / bankMonths.length) : 0);
  const fixedMonthly = perMonth(sum(inBankMonths
    .filter(row => row.amount < 0 && row.category !== null && !NOT_RUNNING_COSTS.has(row.category))
    .map(row => -row.amount)));
  const donationsMonthly = perMonth(sum(inBankMonths
    .filter(row => row.amount > 0 && row.category === 'doacao')
    .map(row => row.amount)));

  const monthRows = months.filter(row => row.month === currentMonth);
  const typicalMonths = months.filter(row => row.complete).slice(-3);
  const typicalInflow = typicalMonths.length
    ? round2(typicalMonths.reduce((total, row) => total + row.inflow, 0) / typicalMonths.length)
    : null;
  const paceInflow = monthRows[0]?.inflow || 0;

  return {
    today: input.today,
    syncedAt: input.syncedAt,
    balance: input.balance,
    series,
    sinceDate: sinceRow?.date || null,
    sinceDelta: input.balance !== null && sinceRow ? round2(input.balance - sinceRow.balance) : null,
    months,
    days,
    flow,
    trips,
    committed,
    free,
    receivable,
    pace: {
      inflow: paceInflow,
      outflow: monthRows[0]?.outflow || 0,
      typicalInflow,
      elapsed: Number(input.today.slice(8, 10)) / daysInMonth(currentMonth),
      share: typicalInflow ? paceInflow / typicalInflow : null,
    },
    fixedMonthly,
    runwayMonths: free !== null && free > 0 && fixedMonthly > 0 ? Math.floor(free / fixedMonthly) : null,
    pilgrimageShare: flowIn > 0 ? pilgrimageFlow / flowIn : null,
    forecast: input.balance === null ? null : {
      today: input.today,
      balance: input.balance,
      donationsMonthly,
      fixedMonthly,
      tripSpendSoFar: sum(input.movements
        .filter(row => row.amount < 0 && row.category !== null && TRIP_CATEGORIES.has(row.category))
        .map(row => -row.amount)),
      noise: Math.max(3000, (donationsMonthly + fixedMonthly) * 0.5),
      quotaValue: QUOTA_VALUE,
      quotaRenewals: input.quotaRenewals,
      trips: trips.map(trip => {
        const source = input.trips.find(item => item.id === trip.id)!;
        return {
          start: trip.start,
          totalDue: trip.totalDue,
          remaining: trip.remaining,
          knownCost: source.knownCost,
          knownCostPaid: source.knownCostPaid,
        };
      }),
    },
  };
}

/**
 * Explainable month-by-month sum, no model:
 * balance + instalments + donations + quotas − running costs − trip costs.
 *
 * Bank outflows are not linked to trips yet, so hotel and transport already paid
 * are credited to the nearest trip first. `costPct` is an assumption the admin
 * controls on the page, and registered supplier costs act as its minimum.
 */
export function projectBalance(inputs: ForecastInputs, costPct: number): ForecastPoint[] {
  const firstIndex = monthIndex(monthOf(inputs.today));
  const lastTrip = inputs.trips.reduce((max, trip) => Math.max(max, monthIndex(monthOf(trip.start))), firstIndex + 5);
  const count = lastTrip - firstIndex + 1;
  const deltas = new Array<number>(count).fill(0);
  const put = (index: number, amount: number) => { deltas[Math.min(Math.max(index, 0), count - 1)] += amount; };

  const today = Number(inputs.today.slice(8, 10));
  const firstMonthLeft = (daysInMonth(monthOf(inputs.today)) - today) / daysInMonth(monthOf(inputs.today));
  for (let i = 0; i < count; i += 1) {
    deltas[i] += (inputs.donationsMonthly - inputs.fixedMonthly) * (i === 0 ? firstMonthLeft : 1);
  }
  inputs.quotaRenewals.forEach(({ month, count: members }) => {
    const index = monthIndex(month) - firstIndex;
    if (index >= 0 && index < count) deltas[index] += members * inputs.quotaValue;
  });

  let spendPool = inputs.tripSpendSoFar;
  [...inputs.trips].sort((a, b) => a.start.localeCompare(b.start)).forEach(trip => {
    const startIndex = monthIndex(monthOf(trip.start)) - firstIndex;
    // Instalments end one month before the trip, as the payment plans state.
    const lastInstalment = Math.max(startIndex - 1, 0);
    const instalment = trip.remaining / (lastInstalment + 1);
    for (let i = 0; i <= lastInstalment; i += 1) put(i, instalment);

    const estimate = Math.max(trip.knownCost, trip.totalDue * (costPct / 100));
    const credited = Math.min(Math.max(estimate - trip.knownCostPaid, 0), spendPool);
    spendPool -= credited;
    const outstanding = Math.max(estimate - trip.knownCostPaid - credited, 0);
    put(startIndex - 1, -outstanding * 0.4);
    put(startIndex, -outstanding * 0.6);
  });

  const points: ForecastPoint[] = [{ date: inputs.today, balance: inputs.balance, low: inputs.balance, high: inputs.balance }];
  let balance = inputs.balance;
  deltas.forEach((delta, i) => {
    balance += delta;
    const spread = inputs.noise * Math.sqrt(i + 1);
    points.push({
      date: monthEnd(monthFromIndex(firstIndex + i)),
      balance: round2(balance),
      low: round2(balance - spread),
      high: round2(balance + spread),
    });
  });
  return points;
}

export { monthOf, toMs, toIso, addDays };
