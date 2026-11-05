import { normalizeForMatch } from './classify';

export type InvoiceCandidate = {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  paymentDate: string;
  customerName: string | null;
  sourceTable: string;
  sourceId: string;
};

const SERIES: Record<string, string> = {
  doacao: 'D',
  peregrinacao: 'D',
  quota: 'Q',
  loja: 'L',
};

export function normalizeInvoiceRef(value: string): string | null {
  const match = value.trim().toUpperCase().match(/^FR\s+(\d{4})([DQL])\s*\/\s*(\d+)$/);
  return match && Number(match[3]) > 0 ? `FR ${match[1]}${match[2]}/${Number(match[3])}` : null;
}

export function validateInvoiceRef(value: string, category: string, bookingDate: string): string | null {
  const normalized = normalizeInvoiceRef(value);
  if (!normalized) return null;
  const expected = SERIES[category];
  if (!expected || !normalized.startsWith(`FR ${bookingDate.slice(0, 4)}${expected}/`)) return null;
  return normalized;
}

function nameTokens(value: string): string[] {
  return normalizeForMatch(value)
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(part => part.length >= 3 && !['DOS', 'DAS', 'UMA', 'THE'].includes(part));
}

export function samePerson(bankName: string | null, customerName: string | null): boolean {
  if (!bankName || !customerName) return false;
  const bank = new Set(nameTokens(bankName));
  const customer = nameTokens(customerName);
  const shared = customer.filter(token => bank.has(token));
  return shared.length >= 2 && shared.length >= Math.min(2, customer.length);
}

/**
 * Someone paying the same amount every month has several FRs in the window.
 * Movements are read oldest first, so the oldest FR belongs to this one. Two
 * different people are never decided here: that stays with the admin.
 */
export function pickSamePayerInvoice<T extends { date: string; customer: string | null }>(named: T[]): T | null {
  if (named.length === 0) return null;
  const people = new Set(named.map(invoice => normalizeForMatch(invoice.customer || '')));
  if (people.size > 1) return null;
  return [...named].sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function matchingCandidates(
  candidates: InvoiceCandidate[],
  movement: { amount: number; bookingDate: string; counterpartyName: string | null },
): InvoiceCandidate[] {
  if (movement.amount <= 0) return [];
  return candidates.filter(candidate =>
    Math.round(candidate.amount * 100) === Math.round(movement.amount * 100)
    && samePerson(movement.counterpartyName, candidate.customerName)
    && candidate.paymentDate.slice(0, 10) >= addDays(movement.bookingDate, -2)
    && candidate.paymentDate.slice(0, 10) <= addDays(movement.bookingDate, 30),
  );
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
