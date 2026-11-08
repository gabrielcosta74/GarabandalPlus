/*
 * Loads the days before the bank feed from the 2026 spreadsheet into
 * bank_history_daily. Without --apply it only prints what it would write.
 *
 *   npx tsx --env-file=.env scripts/import-bank-history.ts <file.xlsx> [--apply]
 */
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

import { addDays, historyFromRows } from '../src/lib/ledger/analysis';

const COLUMN = { date: 3, amount: 6, balance: 7 };

function toNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'result' in value) return toNumber(value.result as ExcelJS.CellValue);
  if (typeof value === 'string') {
    const text = value.replace(/\s|€/g, '');
    const parsed = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
    return text && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error('Indique o ficheiro: scripts/import-bank-history.ts <file.xlsx> [--apply]');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: first, error: firstError } = await supabase.from('bank_transactions')
    .select('booking_date').order('booking_date', { ascending: true }).limit(1).single();
  if (firstError) throw firstError;
  const until = addDays(first.booking_date as string, -1);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets[0];
  const rows: { date: string; amount: number | null; balance: number | null }[] = [];
  sheet.eachRow((row, index) => {
    if (index < 4) return;
    const date = row.getCell(COLUMN.date).value;
    if (!(date instanceof Date)) return;
    rows.push({
      date: date.toISOString().slice(0, 10),
      amount: toNumber(row.getCell(COLUMN.amount).value),
      balance: toNumber(row.getCell(COLUMN.balance).value),
    });
  });

  const history = historyFromRows(rows, until);
  const byMonth = new Map<string, { days: number; inflow: number; outflow: number; closing: number }>();
  history.forEach(day => {
    const month = day.day.slice(0, 7);
    const current = byMonth.get(month) || { days: 0, inflow: 0, outflow: 0, closing: 0 };
    byMonth.set(month, {
      days: current.days + 1,
      inflow: current.inflow + day.inflow,
      outflow: current.outflow + day.outflow,
      closing: day.closing,
    });
  });
  console.log(`Até ${until}: ${history.length} dias de ${rows.length} linhas lidas.`);
  byMonth.forEach((value, month) => {
    console.log(month, `${value.days} dias`, `+${value.inflow.toFixed(2)}`, `-${value.outflow.toFixed(2)}`, `fecho ${value.closing.toFixed(2)}`);
  });

  if (!flags.includes('--apply')) {
    console.log('Nada foi gravado. Use --apply para gravar.');
    return;
  }
  const { error } = await supabase.from('bank_history_daily').upsert(history.map(day => ({
    day: day.day,
    inflow: day.inflow,
    outflow: day.outflow,
    closing_balance: day.closing,
  })), { onConflict: 'day' });
  if (error) throw error;
  console.log(`Gravados ${history.length} dias.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
