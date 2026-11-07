import { categoryLabel, requiresInvoice } from './categories';

/*
 * What has to be true before a month goes to the accountant. Pure: the server
 * loads the data, this decides. Every check names what is missing.
 */

export type CloseMovement = {
  id: string;
  booking_date: string;
  value_date: string | null;
  description_raw: string;
  amount: number;
  status: 'unreviewed' | 'suggested' | 'reconciled' | 'ignored';
  category_code: string | null;
  needs_document: boolean;
  paper_document: boolean;
  notes: string | null;
};

export type CloseInvoice = {
  number: string;
  series: 'D' | 'Q' | 'L' | string;
  date: string;
  gross: number;
  name: string | null;
  method: string | null;
  refunded: boolean;
  fromApp: boolean;
};

export type MonthData = {
  period: string;
  movements: CloseMovement[];
  /** movement id → FR numbers linked to it */
  invoiceRefs: Record<string, string[]>;
  /** movement id → names of the attached files */
  documents: Record<string, string[]>;
  /** FRs issued in the month, plus any FR linked to one of its movements */
  invoices: CloseInvoice[];
  /** FR numbers tied to any bank movement, in any month */
  linkedAnywhere: string[];
  opening: number | null;
  closing: number | null;
  bankReadAt: string | null;
};

export type CloseCheck = {
  key: 'ended' | 'open' | 'invoice' | 'document' | 'balance' | 'factpt' | 'unmatched';
  label: string;
  state: 'ok' | 'fail' | 'warn';
  detail: string;
  goTo?: 'por-tratar' | 'movimentos';
};

const cents = (value: number) => Math.round(value * 100);
const euros = (value: number) => `${(cents(value) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function nextPeriodStart(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

export const isOpenStatus = (status: string) => status === 'unreviewed' || status === 'suggested';

export function missingInvoiceIds(data: MonthData): string[] {
  return data.movements
    .filter(movement => movement.status === 'reconciled' && movement.amount > 0
      && requiresInvoice(movement.category_code) && !(data.invoiceRefs[movement.id] || []).length)
    .map(movement => movement.id);
}

export function missingDocumentIds(data: MonthData): string[] {
  return data.movements
    .filter(movement => movement.status !== 'ignored' && movement.amount < 0 && movement.needs_document
      && !movement.paper_document && !(data.documents[movement.id] || []).length)
    .map(movement => movement.id);
}

export function evaluateClose(data: MonthData, currentPeriod: string): CloseCheck[] {
  const open = data.movements.filter(movement => isOpenStatus(movement.status)).length;
  const noInvoice = missingInvoiceIds(data).length;
  const noDocument = missingDocumentIds(data).length;

  const byNumber = new Map(data.invoices.map(invoice => [invoice.number, invoice]));
  const amountById = new Map(data.movements.map(movement => [movement.id, movement.amount]));
  const problems: string[] = [];
  let checked = 0;
  let total = 0;
  for (const [movementId, refs] of Object.entries(data.invoiceRefs)) {
    const movementAmount = amountById.get(movementId);
    if (movementAmount === undefined) continue;
    let sum = 0;
    for (const ref of refs) {
      const invoice = byNumber.get(ref);
      if (!invoice) { problems.push(`${ref} não existe na FACT.pt`); continue; }
      if (invoice.refunded) problems.push(`${ref} foi reembolsada`);
      sum += cents(invoice.gross);
      checked += 1;
      total += cents(invoice.gross);
    }
    if (refs.length && sum !== cents(movementAmount) && !problems.some(problem => refs.some(ref => problem.startsWith(ref)))) {
      problems.push(`${refs.join(' + ')} não somam ${euros(movementAmount)}`);
    }
  }

  const linked = new Set(data.linkedAnywhere);
  const unmatched = data.invoices.filter(invoice => invoice.fromApp && invoice.method === 'bank_transfer'
    && !invoice.refunded && invoice.date.slice(0, 7) === data.period && !linked.has(invoice.number));

  const bankCovers = !!data.bankReadAt && data.bankReadAt.slice(0, 10) >= nextPeriodStart(data.period);

  return [
    {
      key: 'ended', label: 'O mês já terminou',
      state: data.period < currentPeriod ? 'ok' : 'fail',
      detail: data.period < currentPeriod ? 'Pode ser fechado' : 'Só se fecha depois do último dia do mês',
    },
    {
      key: 'open', label: 'Todos os movimentos tratados', state: open ? 'fail' : 'ok',
      detail: open ? `${open} ainda por tratar` : `${data.movements.length} movimentos tratados`, goTo: 'por-tratar',
    },
    {
      key: 'invoice', label: 'Entradas com fatura-recibo', state: noInvoice ? 'fail' : 'ok',
      detail: noInvoice ? `${noInvoice} sem FR ligada` : 'Todas as doações, quotas, peregrinações e vendas têm FR', goTo: 'movimentos',
    },
    {
      key: 'document', label: 'Despesas com documento', state: noDocument ? 'fail' : 'ok',
      detail: noDocument ? `${noDocument} sem ficheiro nem fatura em papel` : 'Todas têm ficheiro ou fatura em papel', goTo: 'por-tratar',
    },
    {
      key: 'balance', label: 'Saldo confirmado pelo banco',
      state: bankCovers && data.closing !== null ? 'ok' : 'fail',
      detail: bankCovers && data.closing !== null
        ? `Saldo final ${euros(data.closing)}`
        : 'O banco ainda não foi lido depois do fim do mês. Carregue em «Atualizar agora».',
    },
    {
      key: 'factpt', label: 'Faturas iguais às da FACT.pt', state: problems.length ? 'fail' : 'ok',
      detail: problems.length ? problems.slice(0, 3).join(' · ') + (problems.length > 3 ? ` · e mais ${problems.length - 3}` : '')
        : `${checked} FRs conferidas, ${euros(total / 100)}`,
      goTo: 'movimentos',
    },
    {
      key: 'unmatched', label: 'FRs de transferências sem dinheiro no banco',
      state: unmatched.length ? 'warn' : 'ok',
      detail: unmatched.length
        ? `${unmatched.map(invoice => invoice.number).slice(0, 4).join(', ')}${unmatched.length > 4 ? '…' : ''}: confirme se o dinheiro entrou noutro mês`
        : 'Nenhuma',
    },
  ];
}

/** Warnings inform; only failures stop the close. */
export const readyToClose = (checks: CloseCheck[]) => checks.every(check => check.state !== 'fail');

export function runningBalances(opening: number | null, movements: CloseMovement[]): (number | null)[] {
  if (opening === null) return movements.map(() => null);
  let running = cents(opening);
  return movements.map(movement => {
    running += cents(movement.amount);
    return running / 100;
  });
}

export function categoryName(code: string | null): string {
  return code ? categoryLabel(code) : 'Sem categoria';
}
