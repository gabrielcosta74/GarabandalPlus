import { createHash } from 'node:crypto';

/**
 * Parser for the Banco Montepio statement export (Montepio Net → Movimentos).
 *
 * Works on a plain grid of cell values so it is shared by the XLSX reader
 * (exceljs), the CSV reader and the tests. It looks for the header row
 * (DATA MOV. / DATA VALOR / DESCRIÇÃO / IMPORTÂNCIA / SALDO …) and reads
 * every row below it that has a date, a description and an amount.
 */

export type StatementCell = string | number | Date | null | undefined | { result?: unknown; text?: string; richText?: { text: string }[] };

export type StatementRow = {
  /** 1-based row number in the source sheet, for error messages. */
  sourceRow: number;
  bookingDate: string; // YYYY-MM-DD
  valueDate: string | null;
  description: string;
  amount: number; // signed, euros, 2 decimals
  balanceAfter: number | null;
};

export type StatementWarning = {
  sourceRow: number;
  code: 'balance_gap' | 'unreadable_row' | 'missing_balance';
  message: string;
};

export type ParsedStatement = {
  rows: StatementRow[];
  warnings: StatementWarning[];
  periodFrom: string | null;
  periodTo: string | null;
  /** True when every consecutive pair of balances chains with the amount. */
  balanceOk: boolean | null;
};

const HEADER_ALIASES = {
  bookingDate: ['data mov', 'data movimento', 'data lancamento', 'data de lancamento', 'data operacao'],
  valueDate: ['data valor', 'data-valor', 'data de valor'],
  description: ['descricao', 'descritivo', 'movimento'],
  amount: ['importancia', 'montante', 'valor'],
  debit: ['debito'],
  credit: ['credito'],
  balance: ['saldo contabilistico', 'saldo'],
} as const;

type ColumnKey = keyof typeof HEADER_ALIASES;

export function normalizeHeader(value: unknown): string {
  return cellText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: string; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map(part => part.text).join('');
    if (v.result !== undefined) return cellText(v.result);
    if (typeof v.text === 'string') return v.text;
    return '';
  }
  return String(value).trim();
}

/** Parses PT and plain numbers: "1.000,00", "-0,55", "54.34", 54.34, "1 024,00 €". */
export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null;
  if (value && typeof value === 'object' && 'result' in (value as object)) {
    return parseAmount((value as { result?: unknown }).result);
  }
  let text = cellText(value).replace(/€|eur/gi, '').replace(/\s| /g, '');
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
  if (text.endsWith('-')) { negative = true; text = text.slice(0, -1); }
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    // PT format: dots are thousands, comma is the decimal separator.
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma !== -1) {
    // EN format with thousands commas.
    text = text.replace(/,/g, '');
  } else if (lastDot !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.000" with no decimals is a PT thousands separator.
    text = text.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return round2(negative ? -parsed : parsed);
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Accepts Excel serials, Date objects, "dd-mm-yyyy", "dd/mm/yyyy" and "yyyy-mm-dd". */
export function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (value && typeof value === 'object' && 'result' in (value as object)) {
    return parseDate((value as { result?: unknown }).result);
  }
  if (typeof value === 'number' || /^\d{5}(\.\d+)?$/.test(cellText(value))) {
    const serial = Math.floor(Number(value));
    if (serial < 30000 || serial > 80000) return null;
    const date = new Date(EXCEL_EPOCH_MS + serial * 86400000);
    return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = cellText(value);
  let match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/);
  if (match) return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function findHeader(grid: StatementCell[][]): { index: number; columns: Partial<Record<ColumnKey, number>> } | null {
  const limit = Math.min(grid.length, 40);
  for (let r = 0; r < limit; r += 1) {
    // Array.from fills the holes exceljs leaves in sparse rows.
    const cells = Array.from(grid[r] || [], normalizeHeader);
    const columns: Partial<Record<ColumnKey, number>> = {};
    (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach(key => {
      const aliases = HEADER_ALIASES[key] as readonly string[];
      const idx = cells.findIndex(cell => cell && aliases.some(alias => cell === alias || cell.startsWith(alias)));
      if (idx !== -1) columns[key] = idx;
    });
    // "saldo" also matches "saldo disponivel"; prefer the accounting balance when both exist.
    const accounting = cells.findIndex(cell => cell.startsWith('saldo contabil'));
    if (accounting !== -1) columns.balance = accounting;
    // "valor" can match "data valor"; make sure amount is not the value-date column.
    if (columns.amount !== undefined && columns.amount === columns.valueDate) delete columns.amount;
    const hasAmount = columns.amount !== undefined || (columns.debit !== undefined && columns.credit !== undefined);
    if (columns.bookingDate !== undefined && columns.description !== undefined && hasAmount) {
      return { index: r, columns };
    }
  }
  return null;
}

export function parseStatementGrid(grid: StatementCell[][]): ParsedStatement {
  const header = findHeader(grid);
  if (!header) {
    throw new Error('Não encontrei o cabeçalho do extrato (DATA MOV., DESCRIÇÃO, IMPORTÂNCIA).');
  }
  const { columns } = header;
  const rows: StatementRow[] = [];
  const warnings: StatementWarning[] = [];

  for (let r = header.index + 1; r < grid.length; r += 1) {
    const cells = Array.from(grid[r] || []);
    const valueDate = columns.valueDate !== undefined ? parseDate(cells[columns.valueDate]) : null;
    // A blank or mistyped booking date falls back to the value date.
    const bookingDate = parseDate(cells[columns.bookingDate!]) || valueDate;
    const description = cellText(cells[columns.description!]).replace(/\s+/g, ' ').trim();
    let amount: number | null = null;
    if (columns.amount !== undefined) {
      amount = parseAmount(cells[columns.amount]);
    } else {
      const debit = parseAmount(cells[columns.debit!]);
      const credit = parseAmount(cells[columns.credit!]);
      if (debit !== null || credit !== null) amount = round2((credit || 0) - Math.abs(debit || 0));
    }
    const isBlank = cells.every(cell => cellText(cell) === '');
    if (isBlank) continue;
    if (!bookingDate || !description || amount === null) {
      // Footers ("Saldo final", totals) are expected; only warn when the row looks like a movement.
      if (bookingDate || amount !== null) {
        warnings.push({ sourceRow: r + 1, code: 'unreadable_row', message: `Linha ${r + 1} não tem data, descrição ou valor legível.` });
      }
      continue;
    }
    const balanceAfter = columns.balance !== undefined ? parseAmount(cells[columns.balance]) : null;
    if (columns.balance !== undefined && balanceAfter === null) {
      // Every real statement line carries the running balance; a line without
      // one was typed or pasted by hand and is not a bank movement.
      warnings.push({ sourceRow: r + 1, code: 'missing_balance', message: `Linha ${r + 1} não tem saldo — não parece um movimento do extrato e foi ignorada.` });
      continue;
    }
    rows.push({
      sourceRow: r + 1,
      bookingDate,
      valueDate,
      description,
      amount,
      balanceAfter,
    });
  }

  const balance = checkBalanceChain(rows);
  warnings.push(...balance.warnings);
  const dates = rows.map(row => row.bookingDate).sort();

  return {
    rows,
    warnings,
    periodFrom: dates[0] || null,
    periodTo: dates[dates.length - 1] || null,
    balanceOk: balance.ok,
  };
}

/**
 * Montepio lists movements oldest → newest (some exports newest → oldest).
 * Each balance must equal the previous balance plus the movement amount.
 */
export function checkBalanceChain(rows: StatementRow[]): { ok: boolean | null; warnings: StatementWarning[] } {
  const withBalance = rows.filter(row => row.balanceAfter !== null);
  if (withBalance.length < 2) return { ok: null, warnings: [] };

  const chains = (ordered: StatementRow[]) => {
    const gaps: StatementWarning[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      const expected = round2((ordered[i - 1].balanceAfter as number) + ordered[i].amount);
      if (Math.abs(expected - (ordered[i].balanceAfter as number)) > 0.005) {
        gaps.push({
          sourceRow: ordered[i].sourceRow,
          code: 'balance_gap',
          message: `Saldo não encadeia na linha ${ordered[i].sourceRow}: esperado ${expected.toFixed(2)}, extrato diz ${(ordered[i].balanceAfter as number).toFixed(2)}.`,
        });
      }
    }
    return gaps;
  };

  const forward = chains(withBalance);
  if (forward.length === 0) return { ok: true, warnings: [] };
  const backward = chains([...withBalance].reverse());
  if (backward.length === 0) return { ok: true, warnings: [] };
  const best = forward.length <= backward.length ? forward : backward;
  return { ok: false, warnings: best };
}

/**
 * Stable identity for a statement line, the same whether it comes from the
 * XLSX, the CSV or (later) the bank API: booking date, amount and the
 * description without accents/spacing differences. The balance and value date
 * are left out on purpose, because not every format carries them. Identical
 * lines on the same day are told apart by their order of occurrence.
 */
export function fingerprintRows(accountId: string, rows: StatementRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map(row => {
    const base = [
      accountId,
      row.bookingDate,
      row.amount.toFixed(2),
      normalizeDescription(row.description),
    ].join('|');
    const occurrence = seen.get(base) || 0;
    seen.set(base, occurrence + 1);
    return createHash('sha256').update(`${base}|${occurrence}`).digest('hex');
  });
}

export function normalizeDescription(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}
