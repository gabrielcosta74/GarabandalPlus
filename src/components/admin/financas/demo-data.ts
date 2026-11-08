import { addDays, buildAnalysis, type Analysis, type AnalysisMovement, type HistoryDay } from '../../../lib/ledger/analysis';

/** Invented figures for ?demo=1. Deterministic, so the page looks the same every time. */
export function demoAnalysis({ withHistory = true }: { withHistory?: boolean } = {}): Analysis {
  const today = new Date().toISOString().slice(0, 10);
  const wave = (i: number, period: number) => Math.sin((i / period) * Math.PI * 2);
  const year = Number(today.slice(0, 4));
  const start = `${year}-01-01`;
  const firstBank = addDays(today, -92);

  const history: HistoryDay[] = [];
  let closing = 90000;
  for (let day = start, i = 0; day < firstBank; day = addDays(day, 1), i += 1) {
    const inflow = i % 2 === 0 ? 900 + 700 * (wave(i, 60) + 1) : 0;
    const outflow = i % 11 === 0 ? 2600 + 1800 * (wave(i, 40) + 1) : 0;
    closing += inflow - outflow;
    history.push({ day, inflow: Math.round(inflow), outflow: Math.round(outflow), closing: Math.round(closing) });
  }

  const movements: AnalysisMovement[] = [];
  for (let i = 0; i < 92; i += 1) {
    const date = addDays(firstBank, i);
    if (i % 2 === 0) movements.push({ date, amount: 780 + 340 * (wave(i, 21) + 1), category: 'liquidacao_reduniq' });
    if (i % 3 === 0) movements.push({ date, amount: 240 + 110 * (wave(i, 9) + 1), category: 'peregrinacao' });
    if (i % 5 === 0) movements.push({ date, amount: 160, category: 'doacao' });
    if (i % 9 === 0) movements.push({ date, amount: -(2100 + 900 * (wave(i, 30) + 1)), category: 'alojamento' });
    if (i % 23 === 0) movements.push({ date, amount: -2400, category: 'viagem' });
    if (i % 15 === 0) movements.push({ date, amount: -780, category: 'outra_despesa' });
    if (i % 30 === 0) movements.push({ date, amount: -310, category: 'contabilidade' });
    if (i % 14 === 0) movements.push({ date, amount: -48, category: 'software' });
  }

  // The invented history ends exactly where the invented bank movements begin.
  const balance = 248730.42;
  const opening = balance - movements.reduce((total, row) => total + row.amount, 0);
  const offset = history.length ? opening - history[history.length - 1].closing : 0;
  history.forEach(row => { row.closing = Math.round(row.closing + offset); });

  return buildAnalysis({
    today,
    balance,
    syncedAt: new Date().toISOString(),
    movements,
    history: withHistory ? history : [],
    trips: [
      { id: 'demo-a', title: 'Peregrinação a Fátima - Caminho da Luz - Exemplo', start: addDays(today, 24), totalDue: 90000, paid: 84000, knownCost: 0, knownCostPaid: 0 },
      { id: 'demo-b', title: 'Peregrinação a Roma e Assis - Exemplo', start: addDays(today, 165), totalDue: 150000, paid: 76000, knownCost: 14000, knownCostPaid: 500 },
      { id: 'demo-c', title: 'Peregrinação a Lourdes - Caminho Azul - Exemplo', start: addDays(today, 340), totalDue: 72000, paid: 15000, knownCost: 0, knownCostPaid: 0 },
    ],
    quotaRenewals: [{ month: `${year + 1}-01`, count: 120 }],
    cardPayments: { pilgrimage: 92, donation: 6, other: 2 },
  });
}
