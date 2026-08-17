import { describe, expect, it } from 'vitest';

import { refreshAutomaticFactPtDocumentDate } from '../lib/factpt/processor';
import type { FactPtFiscalSnapshot } from '../lib/factpt';

const snapshot = {
  sourceType: 'pilgrimage',
  sourceId: 'payment-1',
  paidAt: '2026-08-09T20:00:00.000Z',
  documentDate: '2026-08-09',
  total: 413.27,
  currency: 'EUR',
  paymentMethod: 'reduniq_credit_card',
  customer: {
    name: 'Titular',
    email: 'titular@example.test',
    address: 'Rua Um',
    postalCode: '1000-001',
    city: 'Lisboa',
    country: 'pt',
  },
  lines: [{
    reference: 'PEREGRINACAO',
    description: 'Donativo',
    type: 'other',
    quantity: 1,
    unitPriceNet: 413.27,
    taxRate: 0,
    taxId: 'tax-0',
    unitId: 1,
  }],
  language: 'pt',
} satisfies FactPtFiscalSnapshot;

describe('FACT.pt automatic retry document date', () => {
  it('refreshes only the fiscal document date', () => {
    const refreshed = refreshAutomaticFactPtDocumentDate(
      snapshot,
      new Date('2026-08-17T23:30:00.000Z'),
    );

    expect(refreshed).toEqual({
      ...snapshot,
      documentDate: '2026-08-18',
    });
    expect(refreshed.paidAt).toBe(snapshot.paidAt);
  });

  it('keeps the same object when the Lisbon document date is current', () => {
    expect(refreshAutomaticFactPtDocumentDate(
      snapshot,
      new Date('2026-08-09T12:00:00.000Z'),
    )).toBe(snapshot);
  });
});
