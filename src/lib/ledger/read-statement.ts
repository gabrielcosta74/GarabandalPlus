import 'server-only';

import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

import { classifyMovement, type Classification, type CustomRule } from './classify';
import {
  fingerprintRows,
  parseStatementGrid,
  type ParsedStatement,
  type StatementCell,
  type StatementRow,
} from './montepio-statement';

export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;
export const MAX_STATEMENT_ROWS = 20000;

export type StatementSource = 'xlsx' | 'csv';

export type PreviewMovement = StatementRow & Classification & {
  fingerprint: string;
  duplicate: boolean;
};

export type StatementPreview = {
  fileName: string;
  fileSha256: string;
  source: StatementSource;
  sheetName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  balanceOk: boolean | null;
  warnings: ParsedStatement['warnings'];
  rows: PreviewMovement[];
  counts: { total: number; new: number; duplicate: number };
};

export function detectSource(fileName: string, bytes: Uint8Array): StatementSource {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK": xlsx is a zip
  if (isZip || /\.xlsx$/i.test(fileName)) return 'xlsx';
  if (/\.xls$/i.test(fileName)) {
    throw new Error('O formato .xls antigo não é suportado. No Montepio Net exporte em Excel (.xlsx) ou CSV.');
  }
  return 'csv';
}

/** Montepio CSVs are often Windows-1252; fall back to it when UTF-8 is invalid. */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function parseCsv(text: string): string[][] {
  const firstLines = text.split(/\r?\n/).slice(0, 20).join('\n');
  const delimiter = [';', '\t', ','].reduce((best, candidate) =>
    (firstLines.split(candidate).length > firstLines.split(best).length ? candidate : best), ';');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function readXlsxGrids(bytes: Uint8Array): Promise<{ name: string; grid: StatementCell[][] }[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  return workbook.worksheets.map(sheet => {
    const grid: StatementCell[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = row.values as StatementCell[];
      grid[rowNumber - 1] = Array.from(values.slice(1));
    });
    return { name: sheet.name, grid: Array.from(grid, row => row || []) };
  });
}

export async function readStatementFile(
  fileName: string,
  bytes: Uint8Array,
  options: { accountId: string; customRules?: CustomRule[]; existingFingerprints?: Set<string> },
): Promise<StatementPreview> {
  if (bytes.byteLength === 0) throw new Error('O ficheiro está vazio.');
  if (bytes.byteLength > MAX_STATEMENT_BYTES) throw new Error('O ficheiro é demasiado grande (máximo 10 MB).');

  const source = detectSource(fileName, bytes);
  const candidates = source === 'xlsx'
    ? await readXlsxGrids(bytes)
    : [{ name: null as string | null, grid: parseCsv(decodeText(bytes)) as StatementCell[][] }];

  let parsed: ParsedStatement | null = null;
  let sheetName: string | null = null;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      parsed = parseStatementGrid(candidate.grid);
      sheetName = candidate.name;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!parsed) throw lastError instanceof Error ? lastError : new Error('Não foi possível ler o extrato.');
  if (parsed.rows.length === 0) throw new Error('Não encontrei movimentos no extrato.');
  if (parsed.rows.length > MAX_STATEMENT_ROWS) throw new Error(`O extrato tem mais de ${MAX_STATEMENT_ROWS} linhas. Exporte um período mais curto.`);

  const fingerprints = fingerprintRows(options.accountId, parsed.rows);
  const existing = options.existingFingerprints || new Set<string>();
  const rows: PreviewMovement[] = parsed.rows.map((row, index) => ({
    ...row,
    ...classifyMovement(row.description, row.amount, options.customRules || []),
    fingerprint: fingerprints[index],
    duplicate: existing.has(fingerprints[index]),
  }));
  const duplicate = rows.filter(row => row.duplicate).length;

  return {
    fileName,
    fileSha256: createHash('sha256').update(bytes).digest('hex'),
    source,
    sheetName,
    periodFrom: parsed.periodFrom,
    periodTo: parsed.periodTo,
    balanceOk: parsed.balanceOk,
    warnings: parsed.warnings,
    rows,
    counts: { total: rows.length, new: rows.length - duplicate, duplicate },
  };
}

export function markDuplicates(preview: StatementPreview, existing: Set<string>): StatementPreview {
  let duplicate = 0;
  preview.rows.forEach(row => {
    row.duplicate = existing.has(row.fingerprint);
    if (row.duplicate) duplicate += 1;
  });
  preview.counts = { total: preview.rows.length, new: preview.rows.length - duplicate, duplicate };
  return preview;
}
