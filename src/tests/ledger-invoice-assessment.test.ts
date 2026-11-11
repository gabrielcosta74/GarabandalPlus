import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ documents: [] as Record<string, unknown>[], links: [] as Record<string, unknown>[] }));

vi.mock('server-only', () => ({}));
vi.mock('../lib/ledger/server', () => ({
  db: () => ({
    from(table: string) {
      return {
        select() { return this; }, eq() { return this; }, gte() { return this; }, lt() { return this; }, in() { return this; },
        or() { return this; }, neq() { return this; },
        async maybeSingle() { return { data: null, error: null }; },
        then(resolve: (value: unknown) => void) {
          const data = table === 'factpt_documents' ? fixture.documents
            : table === 'bank_transaction_links' ? fixture.links
            : table === 'pilgrimage_payments' ? [
              { id: 'payment-1', user_id: null, billing_name: 'Maria Costa', amount: 100, created_at: '2026-10-17' },
              { id: 'payment-2', user_id: null, billing_name: 'Maria Costa', amount: 100, created_at: '2026-10-18' },
            ] : [];
          resolve({ data, error: null });
        },
      };
    },
  }),
}));

import { assessInvoice } from '../lib/ledger/invoice-assessment';

const movement = { id: 'movement-1', amount: 100, booking_date: '2026-10-18', counterparty_name: 'Maria Costa' };

beforeEach(() => { fixture.documents = []; fixture.links = []; });

describe('manual choice of equal pending pilgrimage payments', () => {
  it('offers the pending payment IDs only when there is no matching FACT.pt document', async () => {
    const assessment = await assessInvoice(movement, 'peregrinacao');
    expect(assessment.ambiguous).toBe(true);
    expect(assessment.manualPendingPaymentIds).toEqual(['payment-1', 'payment-2']);
  });

  it('keeps the choice blocked when a FACT.pt document is also a candidate', async () => {
    fixture.documents = [{
      id: 'document-1', factpt_number: null, status: 'queued', amount: 100,
      payment_confirmed_at: '2026-10-18T12:00:00Z', fiscal_snapshot: { customer: { name: 'Maria Costa' } },
      source_snapshot: null, source_type: 'pilgrimage', source_table: 'pilgrimage_payments', source_id: 'payment-3',
    }];
    const assessment = await assessInvoice(movement, 'peregrinacao');
    expect(assessment.ambiguous).toBe(true);
    expect(assessment.manualPendingPaymentIds).toEqual([]);
  });

  it('ignores an issued FR already reconciled with another bank movement', async () => {
    fixture.documents = [{
      id: 'document-1', factpt_number: 'FR 2026D/1', status: 'issued', amount: 100,
      payment_confirmed_at: '2026-10-18T12:00:00Z', fiscal_snapshot: { customer: { name: 'Maria Costa' } },
      source_snapshot: null, source_type: 'pilgrimage', source_table: 'pilgrimage_payments', source_id: 'payment-old',
    }];
    fixture.links = [{ target_type: 'pilgrimage_payment', target_id: 'payment-old' }];
    const assessment = await assessInvoice(movement, 'peregrinacao');
    expect(assessment.issued).toBeNull();
    expect(assessment.nearbyIssuedCount).toBe(0);
    expect(assessment.manualPendingPaymentIds).toEqual(['payment-1', 'payment-2']);
  });
});
