import { addDays, pickSamePayerInvoice, samePerson } from './invoice-safety';

/*
 * Rules for the read-only copy of FACT.pt documents. The copy lets the system
 * see invoices the admin issued by hand there, which the app otherwise cannot.
 */

export type RemoteDocument = {
  id: string | number;
  clientId?: string | number | null;
  number?: string | null;
  type?: string | null;
  date?: string | null;
  paymentStatus?: string | null;
  gross?: string | number | null;
  permanentUrl?: string | null;
  identifierId?: string | null;
};

export type MirrorRow = {
  remote_id: string;
  number: string;
  doc_type: string;
  doc_date: string;
  gross: number;
  payment_status: string | null;
  client_id: string | null;
  identifier_id: string | null;
  permanent_url: string | null;
};

export type ManualInvoice = { number: string; amount: number; date: string; customer: string | null };

export type ManualMatch = {
  confidence: 'manual' | 'manual_likely' | 'ambiguous';
  invoiceRefs: string[];
};

const CANCELLED = /cancel|anul|void/i;

/** The app stamps its documents with "gp:<source>:<id>"; anything else was made by hand. */
export function isAppDocument(identifierId: string | null | undefined): boolean {
  return !!identifierId && identifierId.startsWith('gp:');
}

/** FACT.pt lists "2026D/1243"; the app and the accountant write "FR 2026D/1243". */
export function invoiceRefFor(docType: string, number: string): string | null {
  if (docType !== 'invoicereceipt') return null;
  const match = number.trim().toUpperCase().match(/^(?:FR\s+)?(\d{4}[A-Z]+)\s*\/\s*0*([1-9]\d*)$/);
  return match ? `FR ${match[1]}/${match[2]}` : null;
}

export function toMirrorRow(document: RemoteDocument): MirrorRow | null {
  const gross = Number(document.gross);
  const date = String(document.date || '').slice(0, 10);
  if (!document.id || !document.number || !document.type
      || !Number.isFinite(gross) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    remote_id: String(document.id),
    number: String(document.number),
    doc_type: String(document.type),
    doc_date: date,
    gross,
    payment_status: document.paymentStatus ? String(document.paymentStatus) : null,
    client_id: document.clientId === null || document.clientId === undefined ? null : String(document.clientId),
    identifier_id: document.identifierId ? String(document.identifierId) : null,
    permanent_url: document.permanentUrl ? String(document.permanentUrl) : null,
  };
}

/** Which end holds the newest documents is read from the data, not assumed. */
export function pagesNewestFirst(totalPages: number, firstPageDate: string, lastPageDate: string): number[] {
  const pages = Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1);
  return firstPageDate <= lastPageDate ? pages.reverse() : pages;
}

export function usableManualInvoice(row: {
  doc_type: string; number: string; gross: number | string; doc_date: string;
  payment_status: string | null; identifier_id: string | null; client_name: string | null;
}): ManualInvoice | null {
  if (isAppDocument(row.identifier_id) || CANCELLED.test(row.payment_status || '')) return null;
  const number = invoiceRefFor(row.doc_type, row.number);
  return number ? { number, amount: Number(row.gross), date: row.doc_date, customer: row.client_name } : null;
}

/** Same window as the app's own invoices: the FR comes on or after the money. */
export function matchManualInvoice(
  movement: { amount: number; bookingDate: string; counterpartyName: string | null },
  invoices: ManualInvoice[],
): ManualMatch | null {
  const candidates = invoices.filter(invoice =>
    Math.round(invoice.amount * 100) === Math.round(movement.amount * 100)
    && invoice.date >= addDays(movement.bookingDate, -2)
    && invoice.date <= addDays(movement.bookingDate, 30));
  if (candidates.length === 0) return null;
  const named = candidates.filter(invoice => samePerson(movement.counterpartyName, invoice.customer));
  const samePayer = pickSamePayerInvoice(named);
  if (samePayer) return { confidence: 'manual', invoiceRefs: [samePayer.number] };
  if (named.length > 1) return { confidence: 'ambiguous', invoiceRefs: named.map(invoice => invoice.number) };
  if (candidates.length === 1) return { confidence: 'manual_likely', invoiceRefs: [candidates[0].number] };
  return { confidence: 'ambiguous', invoiceRefs: candidates.map(invoice => invoice.number) };
}

export type DonorIdentity = {
  name: string; email: string; nif: string | null;
  address: string; zip: string; city: string; country: string;
};

const FIELD_LABELS: [keyof DonorIdentity, string][] = [
  ['name', 'nome'], ['email', 'email'], ['address', 'morada'],
  ['zip', 'código postal'], ['city', 'cidade'], ['country', 'país'],
];

/** FACT.pt refuses a donation FR without all of these; say so before trying. */
export function missingDonorFields(donor: Partial<DonorIdentity>): string[] {
  const missing = FIELD_LABELS
    .filter(([field]) => !String(donor[field] || '').trim())
    .map(([, label]) => label);
  if (donor.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donor.email.trim())) missing.push('email válido');
  if (donor.country?.trim() && !/^[a-z]{2}$/i.test(donor.country.trim())) missing.push('país com 2 letras');
  return missing;
}
