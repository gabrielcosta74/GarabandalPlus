import { describe, expect, it } from 'vitest';

import {
  buildFactPtAdminOverview,
  currentLisbonCivilMonthPeriod,
  normalizeFactPtAdminPayments,
  type FactPtAdminDocumentRow,
} from '../lib/factpt/admin-overview';

const period = {
  from: '2026-06-30T23:00:00.000Z',
  to: '2026-07-31T23:00:00.000Z',
  label: 'julho de 2026',
  timezone: 'Europe/Lisbon' as const,
  endExclusive: true as const,
};

const document = (
  overrides: Partial<FactPtAdminDocumentRow> = {},
): FactPtAdminDocumentRow => ({
  id: 'document-1',
  environment: 'production',
  source_type: 'pilgrimage',
  source_table: 'pilgrimage_payments',
  source_id: 'payment-1',
  source_reference: 'REDUNIQ-1',
  series_code: '2026D',
  document_type: 'invoice_receipt',
  status: 'issued',
  identifier_id: 'gp:pilgrimage:payment-1',
  amount: 10.1,
  currency: 'EUR',
  payment_method: 'reduniq',
  payment_confirmed_at: '2026-07-30T10:00:00.000Z',
  email_to: 'titular@example.test',
  fiscal_snapshot: {
    customer: {
      name: 'Titular',
      email: 'titular@example.test',
      nif: '123456789',
    },
  },
  factpt_document_id: 'remote-1',
  factpt_number: 'FR 2026D/813',
  issued_at: '2026-07-30T10:00:02.000Z',
  email_sent_at: '2026-07-30T10:00:03.000Z',
  created_at: '2026-07-30T10:00:00.000Z',
  updated_at: '2026-07-30T10:00:03.000Z',
  ...overrides,
});

describe('FACT.pt admin overview', () => {
  it('uses the Lisbon civil month independently of the server timezone', () => {
    expect(
      currentLisbonCivilMonthPeriod(
        new Date('2026-07-30T12:00:00.000Z'),
      ),
    ).toMatchObject({
      from: '2026-06-30T23:00:00.000Z',
      to: '2026-07-31T23:00:00.000Z',
      timezone: 'Europe/Lisbon',
    });
  });

  it('recognizes Reduniq donations only through metadata.provider', () => {
    const payments = normalizeFactPtAdminPayments({
      donations: [
        {
          id: 'donation-reduniq',
          amount_cents: 100,
          currency: 'EUR',
          method: 'stripe_card',
          status: 'succeeded',
          metadata: { provider: 'reduniq' },
          updated_at: '2026-07-30T08:00:00.000Z',
        },
        {
          id: 'donation-not-reduniq',
          amount_cents: 200,
          currency: 'EUR',
          method: 'stripe_card',
          status: 'succeeded',
          metadata: {},
          updated_at: '2026-07-30T08:01:00.000Z',
        },
      ],
      pilgrimagePayments: [],
      storeOrders: [],
      quotaPayments: [],
    });

    expect(payments.map((payment) => payment.provider)).toEqual([
      'reduniq',
      'other',
    ]);
  });

  it('reconciles the charged pilgrimage total and counts email_failed as issued', () => {
    const payments = normalizeFactPtAdminPayments({
      donations: [],
      pilgrimagePayments: [{
        id: 'payment-1',
        user_id: 'member-1',
        amount: 10,
        charged_amount: 10,
        notes: 'Taxa de processamento: 0,10 EUR | Total cobrado: 10,10 EUR',
        method: 'reduniq_card',
        status: 'verified',
        verified_at: '2026-07-30T10:00:00.000Z',
        deleted: false,
      }],
      storeOrders: [],
      quotaPayments: [],
      members: [{
        id: 'member-1',
        nome: 'Titular',
        email: 'titular@example.test',
      }],
    });
    const result = buildFactPtAdminOverview({
      environment: 'production',
      period,
      settings: {
        environment: 'production',
        auto_enabled: true,
        production_pilgrimages_only: true,
        go_live_at: '2026-07-29T00:00:00.000Z',
      },
      documents: [document({
        status: 'email_failed',
        email_sent_at: null,
      })],
      payments,
    });

    expect(result.reconciliation).toMatchObject({
      reduniqConfirmedAmount: 10.1,
      factptIssuedAmount: 10.1,
      difference: 0,
      confirmedPayments: 1,
      matchedDocuments: 1,
      unmatchedPayments: 0,
      mismatchedPayments: 0,
      status: 'reconciled',
    });
    expect(result.kpis.emailFailures).toBe(1);
    expect(result.kpis.issued).toBe(1);
    expect(result.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'email_failed',
          documentId: 'document-1',
        }),
      ]),
    );
  });

  it('does not flag payments before production cutoffs unless a local job exists', () => {
    const payments = normalizeFactPtAdminPayments({
      donations: [
        {
          id: 'old-donation',
          amount_cents: 500,
          currency: 'EUR',
          method: 'stripe_card',
          status: 'succeeded',
          metadata: { provider: 'reduniq' },
          updated_at: '2026-07-01T08:00:00.000Z',
        },
        {
          id: 'new-donation',
          amount_cents: 700,
          currency: 'EUR',
          method: 'stripe_card',
          status: 'succeeded',
          metadata: { provider: 'reduniq' },
          updated_at: '2026-07-30T08:00:00.000Z',
        },
      ],
      pilgrimagePayments: [],
      storeOrders: [],
      quotaPayments: [],
    });
    const result = buildFactPtAdminOverview({
      environment: 'production',
      period,
      settings: {
        environment: 'production',
        auto_enabled: true,
        production_donations_enabled: true,
        donations_go_live_at: '2026-07-29T00:00:00.000Z',
      },
      documents: [],
      payments,
    });

    expect(result.reconciliation.confirmedPayments).toBe(1);
    expect(result.reconciliation.reduniqConfirmedAmount).toBe(7);
    expect(result.attention).toEqual([
      expect.objectContaining({
        type: 'payment_without_document',
        sourceId: 'new-donation',
      }),
    ]);
  });

  it('keeps manually issued payments and failed jobs out of attention', () => {
    const payments = normalizeFactPtAdminPayments({
      donations: [{
        id: 'manual-donation',
        amount_cents: 5500,
        currency: 'EUR',
        method: 'pix',
        status: 'succeeded',
        metadata: { provider: 'reduniq' },
        updated_at: '2026-07-30T08:00:00.000Z',
        invoice_sent_at: '2026-07-30T09:00:00.000Z',
      }],
      pilgrimagePayments: [],
      storeOrders: [],
      quotaPayments: [],
    });
    const result = buildFactPtAdminOverview({
      environment: 'production',
      period,
      settings: {
        environment: 'production',
        auto_enabled: true,
        production_donations_enabled: true,
        donations_go_live_at: '2026-07-29T00:00:00.000Z',
      },
      documents: [document({
        id: 'failed-manual-job',
        source_type: 'donation',
        source_table: 'donations',
        source_id: 'manual-donation',
        status: 'failed',
        factpt_document_id: null,
        factpt_number: null,
        issued_at: null,
        email_sent_at: null,
        last_error: 'Cliente final já existente.',
      })],
      payments,
    });

    expect(result.attention).toEqual([]);
    expect(result.documents).toEqual([]);
    expect(result.kpis.totalDocuments).toBe(0);
    expect(result.reconciliation.confirmedPayments).toBe(0);
    expect(result.reconciliation.status).toBe('empty');
  });

  it('reports cent-level mismatches without treating remote number gaps as work', () => {
    const payments = normalizeFactPtAdminPayments({
      donations: [],
      pilgrimagePayments: [{
        id: 'payment-1',
        amount: 10,
        charged_amount: 10.1,
        method: 'reduniq',
        status: 'verified',
        verified_at: '2026-07-30T10:00:00.000Z',
        deleted: false,
      }],
      storeOrders: [],
      quotaPayments: [],
    });
    const result = buildFactPtAdminOverview({
      environment: 'production',
      period,
      settings: {
        environment: 'production',
        auto_enabled: true,
        production_pilgrimages_only: true,
        go_live_at: '2026-07-29T00:00:00.000Z',
      },
      documents: [
        document({ amount: 10, factpt_number: 'FR 2026D/813' }),
        document({
          id: 'document-2',
          source_id: 'unrelated-payment',
          amount: 2,
          factpt_number: 'FR 2026D/815',
        }),
      ],
      payments,
    });

    expect(result.reconciliation.mismatchedPayments).toBe(1);
    expect(result.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'amount_mismatch' }),
      ]),
    );
    expect(result.attention).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'sequence_gap' }),
      ]),
    );
  });
});
