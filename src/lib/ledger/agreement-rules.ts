import { normalizeForMatch } from './classify';

export type AgreementSummary = {
  id: string;
  pilgrimageId: string;
  pilgrimageTitle: string;
  pilgrimageStart: string | null;
  supplier: string;
  description: string | null;
  logisticsLabel: string | null;
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
 * Which agreements a payment most likely belongs to: the supplier's name in the
 * bank line or the note, and an amount that still fits what is left to pay.
 */
export function rankAgreements(movement: { text: string; amount: number }, agreements: AgreementSummary[]): AgreementSummary[] {
  const mine = words(movement.text);
  const fits = (agreement: AgreementSummary) => cents(Math.abs(movement.amount)) <= cents(agreement.remaining);
  return agreements
    .filter(agreement => agreement.status === 'open' && fits(agreement))
    .map(agreement => {
      const theirs = words(`${agreement.supplier} ${agreement.logisticsLabel || ''}`);
      const shared = [...theirs].filter(word => mine.has(word)).length;
      const exactInstalment = cents(Math.abs(movement.amount)) === cents(agreement.remaining) || cents(Math.abs(movement.amount)) * 2 === cents(agreement.remaining);
      return { agreement, score: shared * 10 + (exactInstalment ? 3 : 0) };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.agreement);
}
