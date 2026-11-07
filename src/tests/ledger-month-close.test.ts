import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildAccountantWorkbook } from '../lib/ledger/accountant-export';
import { evaluateClose, nextPeriodStart, readyToClose, runningBalances, type CloseMovement, type MonthData } from '../lib/ledger/month-close-rules';

const move = (id: string, amount: number, extra: Partial<CloseMovement> = {}): CloseMovement => ({
  id, booking_date: '2026-10-10', value_date: '2026-10-10', description_raw: `TR-IPS-Pessoa ${id}`, amount,
  status: 'reconciled', category_code: amount > 0 ? 'doacao' : 'software', needs_document: amount < 0, paper_document: false, notes: null, ...extra,
});

const month = (overrides: Partial<MonthData> = {}): MonthData => ({
  period: '2026-10',
  movements: [move('a', 25), move('b', -10)],
  invoiceRefs: { a: ['FR 2026D/9'] },
  documents: { b: ['fatura.pdf'] },
  invoices: [{ number: 'FR 2026D/9', series: 'D', date: '2026-10-10', gross: 25, name: 'Ana Costa', method: null, refunded: false, fromApp: false }],
  linkedAnywhere: ['FR 2026D/9'],
  opening: 100,
  closing: 115,
  bankReadAt: '2026-11-01T07:00:00Z',
  ...overrides,
});

const state = (data: MonthData, key: string) => evaluateClose(data, '2026-11').find(check => check.key === key)?.state;

describe('closing a month', () => {
  it('is ready when everything is justified', () => {
    expect(readyToClose(evaluateClose(month(), '2026-11'))).toBe(true);
  });

  it('never closes the month in progress', () => {
    expect(evaluateClose(month(), '2026-10').find(check => check.key === 'ended')?.state).toBe('fail');
  });

  it('needs every movement handled', () => {
    expect(state(month({ movements: [move('a', 25, { status: 'suggested' })] }), 'open')).toBe('fail');
  });

  it('needs an FR on every invoiced entry and a document on every expense', () => {
    expect(state(month({ invoiceRefs: {} }), 'invoice')).toBe('fail');
    expect(state(month({ documents: {} }), 'document')).toBe('fail');
    expect(state(month({ documents: {}, movements: [move('a', 25), move('b', -10, { paper_document: true })] }), 'document')).toBe('ok');
  });

  it('ignored movements need nothing', () => {
    expect(state(month({ documents: {}, movements: [move('a', 25), move('b', -10, { status: 'ignored' })] }), 'document')).toBe('ok');
  });

  it('needs a bank read after the month ended', () => {
    expect(state(month({ bankReadAt: '2026-10-30T07:00:00Z' }), 'balance')).toBe('fail');
  });

  it('compares each linked FR with FACT.pt', () => {
    expect(state(month({ invoices: [] }), 'factpt')).toBe('fail');
    expect(state(month({ invoices: [{ ...month().invoices[0], gross: 30 }] }), 'factpt')).toBe('fail');
    expect(state(month({ invoices: [{ ...month().invoices[0], refunded: true }] }), 'factpt')).toBe('fail');
  });

  it('warns, without blocking, about transfer FRs with no money in the bank', () => {
    const orphan = { number: 'FR 2026D/10', series: 'D', date: '2026-10-12', gross: 50, name: null, method: 'bank_transfer', refunded: false, fromApp: true };
    const checks = evaluateClose(month({ invoices: [...month().invoices, orphan] }), '2026-11');
    expect(checks.find(check => check.key === 'unmatched')?.state).toBe('warn');
    expect(readyToClose(checks)).toBe(true);
  });

  it('runs the balance line by line', () => {
    expect(runningBalances(100, [move('a', 25), move('b', -10)])).toEqual([125, 115]);
    expect(nextPeriodStart('2026-12')).toBe('2027-01-01');
  });
});

describe('the workbook for the accountant', () => {
  it('has the sheets the admin sends today, with the month in them', async () => {
    const data = month();
    const bytes = await buildAccountantWorkbook(data, evaluateClose(data, '2026-11'), { generatedAt: '2026-11-07T18:00:00Z', closedBy: 'admin@example.com', draft: false });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      'Resumo', 'Extrato bancário', 'Movimentos doações', 'Quotas', 'Loja online-IVA', 'Recibos verdes', 'Despesas e documentos',
    ]);
    const statement = workbook.getWorksheet('Extrato bancário')!;
    expect(statement.getRow(2).getCell(4).value).toBe(25);
    expect(statement.getRow(2).getCell(5).value).toBe(125);
    expect(statement.getRow(2).getCell(7).value).toBe('FR 2026D/9');
    expect(statement.getRow(3).getCell(7).value).toBe('fatura.pdf');
    expect(workbook.getWorksheet('Movimentos doações')!.getRow(2).getCell(5).value).toBe('FR 2026D/9');
    expect(String(workbook.getWorksheet('Resumo')!.getRow(2).getCell(1).value)).toContain('admin@example.com');
  });

  it('says so when it is a draft', async () => {
    const data = month();
    const bytes = await buildAccountantWorkbook(data, evaluateClose(data, '2026-11'), { generatedAt: '2026-11-07T18:00:00Z', draft: true });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(String(workbook.getWorksheet('Resumo')!.getRow(2).getCell(1).value)).toContain('RASCUNHO');
  });
});
