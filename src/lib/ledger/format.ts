/** "1.024,00 €" — same grouping as the Montepio statement (dot for thousands). */
function formatMoney(value: number): string {
  const [whole, cents] = Math.abs(value).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${cents} €`;
}

/** Signed amounts keep the sign; null prints as a dash. */
export function formatEur(value: number | null | undefined, options: { signed?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const text = formatMoney(value);
  if (value < 0) return `−${text}`;
  if (options.signed && value > 0) return `+${text}`;
  return text;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "2026-11-04" → "4 nov" (or "4 nov 2026" with year). */
export function formatDay(iso: string | null | undefined, withYear = false): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "2026-11" → "Novembro 2026". */
export function formatPeriod(period: string | null | undefined): string {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function sumAmounts(values: number[]): number {
  // Work in cents so totals never drift (0.1 + 0.2 problem).
  return values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;
}
