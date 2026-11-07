import ExcelJS from 'exceljs';

import { formatPeriod } from './format';
import { categoryName, missingDocumentIds, runningBalances, type CloseCheck, type CloseInvoice, type MonthData } from './month-close-rules';

/*
 * The month for Factor M, in the sheets the admin already sends today, plus a
 * summary and the list of documents behind each expense.
 */

const MONEY = '#,##0.00 €;-#,##0.00 €';
const STATUS: Record<string, string> = { unreviewed: 'Por tratar', suggested: 'Por confirmar', reconciled: 'Tratado', ignored: 'Ignorado' };
const METHOD: Record<string, string> = {
  bank_transfer: 'Transferência bancária', manual: 'Registo manual', reduniq_other: 'Reduniq (MB Way / PIX)',
  reduniq_credit_card: 'Reduniq (cartão)', reduniq_card: 'Reduniq (cartão)', stripe_card: 'Cartão',
};

const day = (value: string | null | undefined) => (value ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : null);

function sheet(workbook: ExcelJS.Workbook, name: string, headers: { header: string; key: string; width: number; money?: boolean; date?: boolean }[]) {
  const worksheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.columns = headers.map(({ header, key, width }) => ({ header, key, width }));
  headers.forEach((column, index) => {
    const target = worksheet.getColumn(index + 1);
    if (column.money) target.numFmt = MONEY;
    if (column.date) target.numFmt = 'dd/mm/yyyy';
  });
  const top = worksheet.getRow(1);
  top.font = { bold: true };
  top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  return worksheet;
}

function invoiceRows(invoices: CloseInvoice[], series: string, period: string) {
  return invoices
    .filter(invoice => invoice.series === series && invoice.date.slice(0, 7) === period)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number, 'pt', { numeric: true }))
    .map(invoice => ({
      name: invoice.name || '—',
      method: invoice.method ? METHOD[invoice.method] || invoice.method : invoice.fromApp ? '—' : 'Emitida na FACT.pt',
      paid: day(invoice.date),
      amount: invoice.gross,
      number: invoice.number,
      issued: day(invoice.date),
      state: invoice.refunded ? 'Reembolsada (nota de crédito)' : 'Paga',
    }));
}

export async function buildAccountantWorkbook(data: MonthData, checks: CloseCheck[], meta: { generatedAt: string; closedBy?: string | null; draft: boolean }): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Apostolado de Garabandal';
  workbook.created = new Date(meta.generatedAt);
  const live = data.movements.filter(movement => movement.status !== 'ignored');
  const income = live.filter(movement => movement.amount > 0).reduce((sum, movement) => sum + Math.round(movement.amount * 100), 0) / 100;
  const expenses = live.filter(movement => movement.amount < 0).reduce((sum, movement) => sum + Math.round(movement.amount * 100), 0) / 100;

  const summary = workbook.addWorksheet('Resumo');
  summary.columns = [{ width: 38 }, { width: 22 }, { width: 22 }, { width: 60 }];
  summary.addRow([`Contabilidade · ${formatPeriod(data.period)}`]).font = { bold: true, size: 14 };
  summary.addRow([meta.draft ? 'RASCUNHO: o mês ainda não está fechado' : `Mês fechado por ${meta.closedBy || '—'}`]);
  summary.addRow([`Gerado a ${meta.generatedAt.slice(0, 16).replace('T', ' ')}`]);
  summary.addRow([]);
  for (const [label, value] of [['Saldo inicial', data.opening], ['Entradas', income], ['Saídas', expenses], ['Saldo final', data.closing]] as const) {
    const row = summary.addRow([label, value]);
    row.getCell(2).numFmt = MONEY;
  }
  summary.addRow([]);
  summary.addRow(['Por categoria', 'Entradas', 'Saídas']).font = { bold: true };
  const byCategory = new Map<string, { in: number; out: number }>();
  for (const movement of live) {
    const name = categoryName(movement.category_code);
    const entry = byCategory.get(name) || { in: 0, out: 0 };
    if (movement.amount > 0) entry.in += Math.round(movement.amount * 100); else entry.out += Math.round(movement.amount * 100);
    byCategory.set(name, entry);
  }
  for (const [name, entry] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt'))) {
    const row = summary.addRow([name, entry.in / 100 || null, entry.out / 100 || null]);
    row.getCell(2).numFmt = MONEY;
    row.getCell(3).numFmt = MONEY;
  }
  summary.addRow([]);
  summary.addRow(['Verificações', 'Estado', '', 'Detalhe']).font = { bold: true };
  for (const check of checks) summary.addRow([check.label, check.state === 'ok' ? 'OK' : check.state === 'warn' ? 'Aviso' : 'Falta', '', check.detail]);

  const statement = sheet(workbook, 'Extrato bancário', [
    { header: 'Data mov.', key: 'date', width: 12, date: true },
    { header: 'Data valor', key: 'valueDate', width: 12, date: true },
    { header: 'Descrição', key: 'description', width: 44 },
    { header: 'Importância', key: 'amount', width: 14, money: true },
    { header: 'Saldo', key: 'balance', width: 16, money: true },
    { header: 'Tipo', key: 'type', width: 24 },
    { header: 'Fatura / documento', key: 'proof', width: 34 },
    { header: 'Estado', key: 'state', width: 14 },
    { header: 'Nota', key: 'note', width: 40 },
  ]);
  const balances = runningBalances(data.opening, data.movements);
  data.movements.forEach((movement, index) => {
    const refs = data.invoiceRefs[movement.id] || [];
    const files = data.documents[movement.id] || [];
    const proof = refs.length ? refs.join(', ')
      : files.length ? files.join(', ')
        : movement.paper_document ? 'Fatura em papel (dossier)' : '';
    statement.addRow({
      date: day(movement.booking_date), valueDate: day(movement.value_date), description: movement.description_raw,
      amount: movement.amount, balance: balances[index], type: categoryName(movement.category_code),
      proof, state: STATUS[movement.status] || movement.status, note: movement.notes || '',
    });
  });

  const invoiceColumns = [
    { header: 'Nome completo', key: 'name', width: 36 },
    { header: 'Forma de pagamento', key: 'method', width: 26 },
    { header: 'Data do pagamento', key: 'paid', width: 16, date: true },
    { header: 'Valor (€)', key: 'amount', width: 14, money: true },
    { header: 'Recibo nº', key: 'number', width: 18 },
    { header: 'Data de emissão', key: 'issued', width: 16, date: true },
    { header: 'Estado', key: 'state', width: 28 },
  ];
  sheet(workbook, 'Movimentos doações', invoiceColumns).addRows(invoiceRows(data.invoices, 'D', data.period));
  sheet(workbook, 'Quotas', invoiceColumns).addRows(invoiceRows(data.invoices, 'Q', data.period));
  sheet(workbook, 'Loja online-IVA', invoiceColumns).addRows(invoiceRows(data.invoices, 'L', data.period));

  const freelance = sheet(workbook, 'Recibos verdes', [
    { header: 'Data', key: 'date', width: 12, date: true },
    { header: 'Descrição', key: 'description', width: 44 },
    { header: 'Valor (€)', key: 'amount', width: 14, money: true },
    { header: 'Documento', key: 'proof', width: 40 },
  ]);
  for (const movement of live.filter(item => item.category_code === 'recibos_verdes')) {
    freelance.addRow({ date: day(movement.booking_date), description: movement.description_raw, amount: movement.amount,
      proof: (data.documents[movement.id] || []).join(', ') || (movement.paper_document ? 'Papel (dossier)' : '') });
  }

  const missing = new Set(missingDocumentIds(data));
  const costs = sheet(workbook, 'Despesas e documentos', [
    { header: 'Data', key: 'date', width: 12, date: true },
    { header: 'Descrição', key: 'description', width: 44 },
    { header: 'Categoria', key: 'type', width: 24 },
    { header: 'Valor (€)', key: 'amount', width: 14, money: true },
    { header: 'Documento', key: 'proof', width: 40 },
    { header: 'Nota', key: 'note', width: 40 },
  ]);
  for (const movement of live.filter(item => item.amount < 0)) {
    const files = data.documents[movement.id] || [];
    costs.addRow({
      date: day(movement.booking_date), description: movement.description_raw, type: categoryName(movement.category_code),
      amount: movement.amount,
      proof: files.length ? files.join(', ') : movement.paper_document ? 'Fatura em papel (dossier)' : missing.has(movement.id) ? 'EM FALTA' : 'Não precisa',
      note: movement.notes || '',
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
