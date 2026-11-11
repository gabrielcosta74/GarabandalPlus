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
