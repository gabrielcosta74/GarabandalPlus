import { describe, expect, it } from 'vitest';

import {
  buildAnalysis,
  historyFromRows,
  projectBalance,
  shortTripTitle,
  type AnalysisInput,
} from '../lib/ledger/analysis';

const base: AnalysisInput = {
  today: '2026-11-07',
  balance: 1000,
  syncedAt: '2026-11-07T17:30:00Z',
  movements: [],
  history: [],
  trips: [],
  quotaRenewals: [],
  cardPayments: { pilgrimage: 0, donation: 0, other: 0 },
};

describe('historyFromRows', () => {
  it('ignores settlement breakdown lines, which have no running balance', () => {
    const rows = [
      { date: '2026-03-02', amount: 1000, balance: 5000 },
      { date: '2026-03-02', amount: 400, balance: null },
      { date: '2026-03-02', amount: 600, balance: null },
      { date: '2026-03-02', amount: -200, balance: 4800 },
    ];
    expect(historyFromRows(rows, '2026-08-06')).toEqual([
      { day: '2026-03-02', inflow: 1000, outflow: 200, closing: 4800 },
    ]);
  });

  it('stops before the first day the bank already covers', () => {
    const rows = [
      { date: '2026-08-06', amount: 10, balance: 100 },
      { date: '2026-08-07', amount: 10, balance: 110 },
    ];
    expect(historyFromRows(rows, '2026-08-06').map(row => row.day)).toEqual(['2026-08-06']);
  });
});

describe('buildAnalysis: balance', () => {
  it('walks the balance back from the bank figure, joining the spreadsheet without a gap', () => {
    const analysis = buildAnalysis({
      ...base,
      balance: 311157.84,
      movements: [
        { date: '2026-11-06', amount: 100, category: 'doacao' },
        { date: '2026-11-07', amount: -50.5, category: 'software' },
      ],
      history: [{ day: '2026-11-04', inflow: 0, outflow: 0, closing: 311108.34 }],
    });
    const byDate = Object.fromEntries(analysis.series.map(row => [row.date, row.balance]));
    expect(byDate['2026-11-07']).toBe(311157.84);
    expect(byDate['2026-11-06']).toBe(311208.34);
    expect(byDate['2026-11-05']).toBe(311108.34);
    expect(byDate['2026-11-04']).toBe(311108.34);
  });

  it('reports the change since the start of the year when history exists', () => {
    const analysis = buildAnalysis({
      ...base,
      balance: 300,
      history: [{ day: '2026-01-01', inflow: 0, outflow: 0, closing: 100 }],
      movements: [{ date: '2026-11-07', amount: 1, category: 'doacao' }],
    });
    expect(analysis.sinceDate).toBe('2026-01-01');
    expect(analysis.sinceDelta).toBe(200);
  });

  it('handles an unknown balance without inventing figures', () => {
    const analysis = buildAnalysis({ ...base, balance: null });
    expect(analysis.series).toEqual([]);
    expect(analysis.free).toBeNull();
    expect(analysis.forecast).toBeNull();
  });
});

describe('buildAnalysis: money that is already spoken for', () => {
  const trip = { id: 'a', title: 'Peregrinação a Itália e Medjugorje -  Abril 2027', start: '2027-04-05', end: '2027-04-17', totalDue: 1000, paid: 600, pendingBookingValue: 0, knownCost: 100, knownCostPaid: 100, hotelCost: 0, costLines: [{ amount: 100, paid: 100, dueDate: null }] };

  it('separates advances from free money, net of supplier payments on record', () => {
    const analysis = buildAnalysis({ ...base, balance: 1000, trips: [trip] });
    expect(analysis.committed).toBe(500);
    expect(analysis.free).toBe(500);
    expect(analysis.receivable).toBe(400);
    expect(analysis.trips[0].daysToStart).toBe(149);
  });

  it('keeps pending bookings outside receivables', () => {
    const analysis = buildAnalysis({ ...base, trips: [{ ...trip, pendingBookingValue: 15850 }] });
    expect(analysis.receivable).toBe(400);
    expect(analysis.pendingBookingValue).toBe(15850);
  });

  it('keeps receivables for an ongoing trip without reserving its past advances again', () => {
    const analysis = buildAnalysis({ ...base, trips: [{ ...trip, start: '2026-11-01', end: '2026-11-12' }] });
    expect(analysis.trips[0].ongoing).toBe(true);
    expect(analysis.committed).toBe(0);
    expect(analysis.receivable).toBe(400);
  });

  it('leaves out trips that have ended', () => {
    const analysis = buildAnalysis({ ...base, trips: [{ ...trip, start: '2026-10-01', end: '2026-11-06' }] });
    expect(analysis.trips).toEqual([]);
  });
});

describe('buildAnalysis: flow', () => {
  it('attributes Reduniq settlements to what the site sold, and keeps totals balanced', () => {
    const analysis = buildAnalysis({
      ...base,
      cardPayments: { pilgrimage: 90, donation: 10, other: 0 },
      movements: [
        { date: '2026-11-01', amount: 1000, category: 'liquidacao_reduniq' },
        { date: '2026-11-02', amount: 100, category: 'peregrinacao' },
        { date: '2026-11-03', amount: 50, category: null },
        { date: '2026-11-04', amount: -300, category: 'alojamento' },
        { date: '2026-11-05', amount: -20, category: 'software' },
      ],
    });
    const source = (key: string) => analysis.flow.sources.find(item => item.key === key)?.amount;
    expect(source('pilgrimages')).toBe(1000);
    expect(source('donations')).toBe(100);
    expect(source('unclassified')).toBe(50);
    const dest = (key: string) => analysis.flow.destinations.find(item => item.key === key)?.amount;
    expect(dest('hotels')).toBe(300);
    expect(dest('kept')).toBe(830);
    const totalIn = analysis.flow.sources.reduce((total, item) => total + item.amount, 0);
    const totalOut = analysis.flow.destinations.reduce((total, item) => total + item.amount, 0);
    expect(totalIn).toBeCloseTo(totalOut, 2);
  });

  it('shows the difference as coming from the balance when more left than came in', () => {
    const analysis = buildAnalysis({
      ...base,
      movements: [
        { date: '2026-11-01', amount: 100, category: 'doacao' },
        { date: '2026-11-02', amount: -300, category: 'alojamento' },
      ],
    });
    expect(analysis.flow.sources.find(item => item.key === 'balance')?.amount).toBe(200);
    expect(analysis.flow.destinations.find(item => item.key === 'kept')).toBeUndefined();
  });

  it('excludes movements older than the window', () => {
    const analysis = buildAnalysis({
      ...base,
      movements: [
        { date: '2026-01-01', amount: 999, category: 'doacao' },
        { date: '2026-11-01', amount: 10, category: 'doacao' },
      ],
    });
    expect(analysis.flow.sources.find(item => item.key === 'donations')?.amount).toBe(10);
  });
});

describe('buildAnalysis: running costs and pace', () => {
  const movements = [
    { date: '2026-09-01', amount: 3000, category: 'doacao' },
    { date: '2026-09-05', amount: -500, category: 'software' },
    { date: '2026-09-06', amount: -9000, category: 'alojamento' },
    { date: '2026-10-01', amount: 1000, category: 'doacao' },
    { date: '2026-10-05', amount: -100, category: 'software' },
    { date: '2026-11-01', amount: 7000, category: 'doacao' },
  ];

  it('keeps trip costs out of running costs and averages whole months only', () => {
    const analysis = buildAnalysis({ ...base, balance: 3000, movements });
    expect(analysis.fixedMonthly).toBe(300);
    expect(analysis.forecast?.donationsMonthly).toBe(2000);
    expect(analysis.bankTripOutflow).toBe(9000);
    expect(analysis.runwayMonths).toBe(10);
  });

  it('compares this month with a typical complete month', () => {
    const analysis = buildAnalysis({ ...base, movements });
    expect(analysis.pace.typicalInflow).toBe(2000);
    expect(analysis.pace.inflow).toBe(7000);
    expect(analysis.pace.share).toBe(3.5);
    expect(analysis.pace.elapsed).toBeCloseTo(7 / 30, 5);
  });
});

describe('projectBalance', () => {
  const inputs = {
    today: '2026-11-07',
    balance: 100000,
    donationsMonthly: 0,
    fixedMonthly: 0,
    quotaValue: 25,
    quotaRenewals: [],
    trips: [{ start: '2027-04-05', end: '2027-04-17', ongoing: false, totalDue: 200000, remaining: 100000, knownCost: 0, knownCostPaid: 0, costLines: [] }],
  };

  it('collects what is due before the trip and pays the estimated cost around it', () => {
    const points = projectBalance(inputs, 70);
    const at = (date: string) => points.find(point => point.date === date)!.balance;
    expect(points[0]).toMatchObject({ date: '2026-11-07', balance: 100000 });
    expect(at('2027-02-28')).toBeCloseTo(100000 + 100000 * (4 / 5), 1);
    expect(at('2027-03-31')).toBeCloseTo(200000 - 140000 * 0.4, 1);
    expect(at('2027-04-30')).toBeCloseTo(200000 - 140000, 1);
  });

  it('lowers the outcome when trips cost more', () => {
    const final = (pct: number) => projectBalance(inputs, pct).at(-1)!.balance;
    expect(final(90)).toBeLessThan(final(50));
  });

  it('never estimates below supplier costs already on record', () => {
    const recorded = { ...inputs, trips: [{ ...inputs.trips[0], knownCost: 190000 }] };
    expect(projectBalance(recorded, 50).at(-1)!.balance).toBeCloseTo(200000 - 190000, 1);
  });

  it('subtracts only supplier payments recorded against the trip', () => {
    const paid = { ...inputs, trips: [{ ...inputs.trips[0], knownCost: 140000, knownCostPaid: 10000, costLines: [{ amount: 140000, paid: 10000, dueDate: null }] }] };
    expect(projectBalance(paid, 70).at(-1)!.balance).toBeCloseTo(70000, 1);
  });

  it('does not credit historic bank spending to a future hotel budget', () => {
    const analysis = buildAnalysis({
      ...base,
      movements: [{ date: '2026-09-05', amount: -110449.56, category: 'alojamento' }],
      trips: [{
        id: 'italy', title: 'Itália', start: '2027-04-05', end: '2027-04-17',
        totalDue: 188550, paid: 110461.80, pendingBookingValue: 0, knownCost: 119475, knownCostPaid: 307.58,
        hotelCost: 87375, costLines: [{ amount: 119475, paid: 307.58, dueDate: null }],
      }],
    });
    expect(analysis.bankTripOutflow).toBe(110449.56);
    const final = projectBalance(analysis.forecast!, 70).at(-1)!.balance;
    expect(final).toBeCloseTo(1000 + 78088.20 - 131677.42, 1);
  });

  it('uses hotel and service budgets as the minimum and honours their due dates', () => {
    const trip = { ...inputs.trips[0], knownCost: 190000, knownCostPaid: 10000, costLines: [
      { amount: 150000, paid: 10000, dueDate: '2027-01-15' },
      { amount: 40000, paid: 0, dueDate: null },
    ] };
    const points = projectBalance({ ...inputs, trips: [trip] }, 40);
    expect(points.find(point => point.date === '2027-01-31')?.balance).toBeCloseTo(160000 - 140000, 1);
    expect(points.at(-1)?.balance).toBeCloseTo(20000, 1);
  });

  it('does not re-estimate costs already spent on a trip in progress', () => {
    const trip = { ...inputs.trips[0], start: '2026-11-01', ongoing: true, knownCost: 3000, knownCostPaid: 1000, costLines: [{ amount: 3000, paid: 1000, dueDate: null }] };
    expect(projectBalance({ ...inputs, trips: [trip] }, 70).at(-1)?.balance).toBeCloseTo(198000, 1);
  });

  it('adds expected quota renewals in their month', () => {
    const withQuotas = { ...inputs, quotaRenewals: [{ month: '2027-01', count: 160 }] };
    const delta = projectBalance(withQuotas, 70).at(-1)!.balance - projectBalance(inputs, 70).at(-1)!.balance;
    expect(delta).toBeCloseTo(4000, 1);
  });

  it('shows the full slider range as the forecast band', () => {
    const points = projectBalance(inputs, 70);
    expect(points[0].low).toBe(points[0].high);
    expect(points.at(-1)?.low).toBeCloseTo(projectBalance(inputs, 95).at(-1)!.balance, 1);
    expect(points.at(-1)?.high).toBeCloseTo(projectBalance(inputs, 40).at(-1)!.balance, 1);
  });
});

describe('shortTripTitle', () => {
  it('finds the name people use', () => {
    expect(shortTripTitle('Peregrinação a Garabandal - Caminho Ibérico - Novembro 2026')).toBe('Caminho Ibérico');
    expect(shortTripTitle('Peregrinação a Itália e Medjugorje -  Abril 2027')).toBe('Itália e Medjugorje');
    expect(shortTripTitle('Peregrinação a Garabandal - Caminho Mariano - Outubro 2027')).toBe('Caminho Mariano');
  });
});
