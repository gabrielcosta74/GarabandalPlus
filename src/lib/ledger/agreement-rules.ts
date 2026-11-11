import { normalizeForMatch } from './classify';

export type AgreementSummary = {
  id: string;
  pilgrimageId: string;
  pilgrimageTitle: string;
  pilgrimageStart: string | null;
  supplier: string;
  description: string | null;
  logisticsLabel: string | null;
  /** The logistics line it is tied to, if any: `stay:<id>` or `cost:<id>`. */
  logisticsKey: string | null;
  total: number;
  paidOutsideBank: number;
  paidByBank: number;
  paid: number;
  remaining: number;
  payments: number;
  hasProforma: boolean;
  hasFinalInvoice: boolean;
  status: 'open' | 'cancelled';
};

const cents = (value: number) => Math.round(value * 100);

export function agreementState(agreement: Pick<AgreementSummary, 'total' | 'paid' | 'hasFinalInvoice' | 'status'>):
  'cancelled' | 'paying' | 'paid_waiting_invoice' | 'done' {
  if (agreement.status === 'cancelled') return 'cancelled';
  if (cents(agreement.paid) < cents(agreement.total)) return 'paying';
  return agreement.hasFinalInvoice ? 'done' : 'paid_waiting_invoice';
}

const words = (value: string) => new Set(normalizeForMatch(value).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/)
  .filter(word => word.length >= 4 && !['HOTEL', 'PAGAMENTO', 'DESPESA', 'PEREGRINACAO', 'GRUPO', 'COMPRA', 'TRANSFERENCIA'].includes(word)));

/**
 * Hotels ask for deposits as round shares of the proforma (30 %, 50 %, 20 %…).
 * True when the payment is one of them, to the cent: 3 900 € of 13 000 €.
 */
export function isRoundShare(amount: number, total: number): boolean {
  const paid = cents(Math.abs(amount));
  const whole = cents(total);
  if (!paid || !whole || paid >= whole) return false;
  // Whole percentages only, in steps of 5 %: 5 %, 10 % … 95 %.
  return paid * 100 % whole === 0 && (paid * 100 / whole) % 5 === 0;
}

/**
 * Which agreements a payment most likely belongs to: the supplier's name in the
 * bank line or the note, and an amount that still fits what is left to pay.
 * Bank lines often carry only a SEPA reference ("ORD.PAG. SEPA 7425…"), so an
 * amount that is exactly a deposit share or the balance also counts, on its own.
 */
export function rankAgreements(movement: { text: string; amount: number }, agreements: AgreementSummary[]): AgreementSummary[] {
  const mine = words(movement.text);
  const paid = cents(Math.abs(movement.amount));
  const fits = (agreement: AgreementSummary) => paid <= cents(agreement.remaining);
  return agreements
    .filter(agreement => agreement.status === 'open' && fits(agreement))
    .map(agreement => {
      const theirs = words(`${agreement.supplier} ${agreement.logisticsLabel || ''}`);
      const shared = [...theirs].filter(word => mine.has(word)).length;
      const exactInstalment = paid === cents(agreement.remaining) || paid * 2 === cents(agreement.remaining);
      const share = isRoundShare(movement.amount, agreement.total);
      return { agreement, score: shared * 10 + (exactInstalment ? 3 : 0) + (share ? 2 : 0) };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.agreement);
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "10 → 12 abr" or "30 mar → 2 abr". */
export function nightsLabel(checkIn: string | null, checkOut: string | null): string {
  const a = checkIn ? new Date(`${checkIn}T00:00:00Z`) : null;
  const b = checkOut ? new Date(`${checkOut}T00:00:00Z`) : null;
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'sem datas';
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) => MONTHS[d.getUTCMonth()];
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${day(a)} → ${day(b)} ${month(b)}`
    : `${day(a)} ${month(a)} → ${day(b)} ${month(b)}`;
}

export type PaymentCandidate = {
  id: string;
  bookingDate: string;
  amount: number;
  description: string;
  counterparty: string | null;
};

/**
 * The other way round: which bank debits most likely pay this agreement.
 * Only debits that still fit what is left. A round share of the proforma
 * (30 %, 50 %…), the exact balance or the supplier's name in the bank line
 * rank first; the rest follow by date, newest first.
 */
export function rankPaymentsForAgreement(
  agreement: Pick<AgreementSummary, 'supplier' | 'logisticsLabel' | 'total' | 'remaining'>,
  movements: PaymentCandidate[],
): Array<PaymentCandidate & { reason: string | null }> {
  const theirs = words(`${agreement.supplier} ${agreement.logisticsLabel || ''}`);
  return movements
    .filter(movement => movement.amount < 0 && cents(Math.abs(movement.amount)) <= cents(agreement.remaining))
    .map(movement => {
      const paid = cents(Math.abs(movement.amount));
      const mine = words(`${movement.description} ${movement.counterparty || ''}`);
      const named = [...theirs].some(word => mine.has(word));
      const balance = paid === cents(agreement.remaining);
      const share = isRoundShare(movement.amount, agreement.total);
      const percent = share ? Math.round((paid * 100) / cents(agreement.total)) : null;
      const score = (named ? 10 : 0) + (balance ? 4 : 0) + (share ? 3 : 0);
      const reason = named ? 'Tem o nome do fornecedor' : balance ? 'É o valor que falta' : percent ? `É ${percent} % da proforma` : null;
      return { ...movement, reason, score };
    })
    .sort((a, b) => b.score - a.score || b.bookingDate.localeCompare(a.bookingDate))
    .map(({ score, ...rest }) => { void score; return rest; });
}
