import { describe, expect, it } from 'vitest';
import { matchingCandidates, normalizeInvoiceRef, samePerson, validateInvoiceRef, type InvoiceCandidate } from '../lib/ledger/invoice-safety';

const candidate: InvoiceCandidate = {
  id: 'doc-1',
  number: 'FR 2026D/1171',
  status: 'issued',
  amount: 405.56,
  paymentDate: '2026-10-20T12:00:00Z',
  customerName: 'Maria Helena Costa',
  sourceTable: 'donations',
  sourceId: 'payment-1',
};

describe('ledger invoice safety', () => {
  it('only accepts a FR from the category and booking year', () => {
    expect(validateInvoiceRef('fr 2026d / 001171', 'doacao', '2026-10-18')).toBe('FR 2026D/1171');
    expect(validateInvoiceRef('FR 2026Q/1171', 'doacao', '2026-10-18')).toBeNull();
    expect(validateInvoiceRef('FR 2026D/1171', 'quota', '2026-10-18')).toBeNull();
    expect(validateInvoiceRef('FR 2025D/1171', 'doacao', '2026-10-18')).toBeNull();
    expect(normalizeInvoiceRef('FR 2026D/0')).toBeNull();
    expect(normalizeInvoiceRef('FT 2026D/1171')).toBeNull();
  });

  it('requires two shared name tokens to identify the payer', () => {
    expect(samePerson('MARIA HELENA COSTA', 'Maria Helena Costa')).toBe(true);
    expect(samePerson('TR-IPS-MARIA HELENA COSTA', 'Maria Helena Costa')).toBe(true);
    expect(samePerson('Maria', 'Maria Helena Costa')).toBe(false);
    expect(samePerson('João Pedro Silva', 'Maria Helena Costa')).toBe(false);
  });

  it('requires exact cents and a bounded verification date', () => {
    const movement = { amount: 405.56, bookingDate: '2026-10-18', counterpartyName: 'Maria Helena Costa' };
    expect(matchingCandidates([candidate], movement)).toHaveLength(1);
    expect(matchingCandidates([{ ...candidate, amount: 405.55 }], movement)).toHaveLength(0);
    expect(matchingCandidates([{ ...candidate, paymentDate: '2026-11-19T12:00:00Z' }], movement)).toHaveLength(0);
    expect(matchingCandidates([{ ...candidate, customerName: 'João Pedro Silva' }], movement)).toHaveLength(0);
  });
});
