import { describe, expect, it } from 'vitest';
import { loadUserPaymentAlerts } from '../lib/pilgrimage-payment-alerts.server';
import {
  buildPaymentBannerDismissKey,
  buildPaymentPopupDismissKey,
  comparePaymentAlerts,
  getPilgrimageDisplayName,
  getPaymentAlertSeverity,
  isPaymentAlertSurfaceExcluded,
  shouldShowPaymentAlertBanner,
  shouldShowPaymentAlertPopup,
  type PaymentAlert,
} from '../lib/pilgrimage-payment-alerts';
import { getRegistrationFeeDueDate } from '../lib/pilgrimage-payment-deadlines';
import { resolveOutstandingPaymentObligation } from '../lib/pilgrimage-payment-reminders';

const alert = (overrides: Partial<PaymentAlert> = {}): PaymentAlert => ({
  bookingId: 'booking-1',
  pilgrimageName: 'Garabandal',
  obligationKey: 'installment_1',
  kind: 'installment',
  amountDue: 625,
  totalRemaining: 1250,
  dueDate: '2026-08-10T10:00:00.000Z',
  daysUntilDue: 3,
  severity: 'warning',
  paymentUrl: '/peregrinacoes/inscricao/booking-1',
  ...overrides,
});

describe('pilgrimage display names', () => {
  it('hides the private FactPT test prefix from member-facing payment surfaces', () => {
    expect(getPilgrimageDisplayName('[TESTE PRIVADO FACT.pt] Peregrinação 2026D'))
      .toBe('Peregrinação 2026D');
    expect(getPilgrimageDisplayName('Peregrinação a Garabandal'))
      .toBe('Peregrinação a Garabandal');
  });
});

describe('pilgrimage website payment obligations', () => {
  it('sets the registration fee deadline exactly five calendar days after registration', () => {
    expect(getRegistrationFeeDueDate('2026-08-07T23:30:00.000Z'))
      .toBe('2026-08-12T23:30:00.000Z');
  });

  it('calculates the unpaid registration fee for multiple pilgrims and partial payments', () => {
    const obligation = resolveOutstandingPaymentObligation({
      id: 'booking-partial-deposit',
      user_id: 'user-1',
      created_at: '2026-08-01T10:00:00.000Z',
      total_amount: 2200,
      paid_amount: 400,
      status: 'pending',
      payment_plan: [{ date: '2026-09-10T10:00:00.000Z', amount: 1200 }],
      pilgrimage: { title: 'Garabandal', deposit_value: 500 },
      pilgrims: [
        { birth_date: '1990-01-01' },
        { birth_date: '1992-01-01' },
      ],
      payments: [{
        id: 'payment-1', amount: 400, status: 'verified', method: 'card', created_at: '2026-08-01T11:00:00.000Z',
      }],
    }, { now: new Date('2026-08-02T12:00:00.000Z') });

    expect(obligation).toMatchObject({
      obligationKey: 'deposit',
      expectedAmount: 1000,
      remainingAmount: 600,
      totalRemaining: 1800,
    });
    expect(obligation?.dueDate.slice(0, 10)).toBe('2026-08-06');
  });

  it('suppresses the website prompt while a sufficient receipt is under validation', () => {
    const obligation = resolveOutstandingPaymentObligation({
      id: 'booking-verifying',
      created_at: '2026-08-01T10:00:00.000Z',
      total_amount: 1200,
      paid_amount: 400,
      status: 'pending',
      payment_plan: [{ date: '2026-09-10T10:00:00.000Z', amount: 200 }],
      pilgrimage: { title: 'Fátima', deposit_value: 1000 },
      pilgrims: [{ birth_date: '1990-01-01' }],
      payments: [
        { id: 'paid', amount: 400, status: 'verified', method: 'card', created_at: '2026-08-01T11:00:00.000Z' },
        { id: 'proof', amount: 600, status: 'pending_verification', method: 'bank_transfer', created_at: '2026-08-02T11:00:00.000Z', receipt_url: 'receipts/proof.pdf' },
      ],
    });

    expect(obligation).toBeNull();
  });

  it('does not create obligations for cancelled or fully paid bookings', () => {
    expect(resolveOutstandingPaymentObligation({
      id: 'cancelled', created_at: '2026-08-01', total_amount: 1000, paid_amount: 0, status: 'cancelled', pilgrimage: { deposit_value: 500 },
    })).toBeNull();
    expect(resolveOutstandingPaymentObligation({
      id: 'paid', created_at: '2026-08-01', total_amount: 1000, paid_amount: 1000, status: 'confirmed', pilgrimage: { deposit_value: 500 },
    })).toBeNull();
  });
});

describe('payment alert urgency and persistence', () => {
  it('maps all urgency thresholds', () => {
    expect(getPaymentAlertSeverity(8)).toBe('info');
    expect(getPaymentAlertSeverity(7)).toBe('warning');
    expect(getPaymentAlertSeverity(2)).toBe('urgent');
    expect(getPaymentAlertSeverity(0)).toBe('urgent');
    expect(getPaymentAlertSeverity(-1)).toBe('overdue');
  });

  it('shows the banner for every deposit and installments inside seven days', () => {
    expect(shouldShowPaymentAlertBanner(alert({ kind: 'deposit', daysUntilDue: 20 }))).toBe(true);
    expect(shouldShowPaymentAlertBanner(alert({ daysUntilDue: 8 }))).toBe(false);
    expect(shouldShowPaymentAlertBanner(alert({ daysUntilDue: 7 }))).toBe(true);
  });

  it('reserves popups for two days or less and overdue payments', () => {
    expect(shouldShowPaymentAlertPopup(alert({ daysUntilDue: 3 }))).toBe(false);
    expect(shouldShowPaymentAlertPopup(alert({ daysUntilDue: 2 }))).toBe(true);
    expect(shouldShowPaymentAlertPopup(alert({ daysUntilDue: -4 }))).toBe(true);
  });

  it('sorts overdue and earlier obligations first, preferring deposits on a tie', () => {
    const alerts = [
      alert({ bookingId: 'future', daysUntilDue: 4 }),
      alert({ bookingId: 'installment', daysUntilDue: -1 }),
      alert({ bookingId: 'deposit', obligationKey: 'deposit', kind: 'deposit', daysUntilDue: -1 }),
    ].sort(comparePaymentAlerts);

    expect(alerts.map((item) => item.bookingId)).toEqual(['deposit', 'installment', 'future']);
  });

  it('uses daily popup keys and session-level banner keys', () => {
    const item = alert();
    const firstDay = buildPaymentPopupDismissKey('user-1', item, new Date(2026, 7, 7, 9));
    const sameDay = buildPaymentPopupDismissKey('user-1', item, new Date(2026, 7, 7, 22));
    const nextDay = buildPaymentPopupDismissKey('user-1', item, new Date(2026, 7, 8, 9));

    expect(firstDay).toBe(sameDay);
    expect(nextDay).not.toBe(firstDay);
    expect(buildPaymentBannerDismissKey('user-1', item)).not.toContain('2026-08-07');
  });

  it('excludes auth, checkout, payment return and registration flows', () => {
    expect(isPaymentAlertSurfaceExcluded('/login')).toBe(true);
    expect(isPaymentAlertSurfaceExcluded('/en/store/checkout')).toBe(true);
    expect(isPaymentAlertSurfaceExcluded('/payments/mobile-return/pilgrimage/123')).toBe(true);
    expect(isPaymentAlertSurfaceExcluded('/peregrinacoes/garabandal/inscrever')).toBe(true);
    expect(isPaymentAlertSurfaceExcluded('/peregrinacoes/inscricao/123')).toBe(true);
    expect(isPaymentAlertSurfaceExcluded('/member')).toBe(false);
  });
});

describe('payment alerts ownership query', () => {
  it('filters the database by the authenticated user and rejects foreign rows defensively', async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const rows = [
      {
        id: 'own-booking', user_id: 'user-1', created_at: '2026-08-01T10:00:00.000Z', total_amount: 1200, paid_amount: 500, status: 'confirmed',
        payment_plan: [{ date: '2026-08-10T10:00:00.000Z', amount: 700 }],
        pilgrimage: { title: 'Garabandal', deposit_value: 500, start_date: '2027-05-01' },
        pilgrims: [{ birth_date: '1990-01-01' }],
        payments: [{ id: 'deposit', amount: 500, status: 'verified', method: 'card', created_at: '2026-08-01T11:00:00.000Z' }],
      },
      {
        id: 'foreign-booking', user_id: 'user-2', created_at: '2026-08-01T10:00:00.000Z', total_amount: 1000, paid_amount: 0, status: 'pending',
        payment_plan: [], pilgrimage: { title: 'Foreign', deposit_value: 500, start_date: '2027-05-01' }, pilgrims: [], payments: [],
      },
      {
        id: 'started-booking', user_id: 'user-1', created_at: '2026-06-01T10:00:00.000Z', total_amount: 1000, paid_amount: 0, status: 'pending',
        payment_plan: [], pilgrimage: { title: 'Started', deposit_value: 500, start_date: '2026-08-01' }, pilgrims: [], payments: [],
      },
      {
        id: 'canceled-booking', user_id: 'user-1', created_at: '2026-08-01T10:00:00.000Z', total_amount: 1000, paid_amount: 0, status: 'canceled',
        payment_plan: [], pilgrimage: { title: 'Canceled', deposit_value: 500, start_date: '2027-05-01' }, pilgrims: [], payments: [],
      },
    ];
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { eqCalls.push([column, value]); return query; },
      neq() { return query; },
      async order() { return { data: rows, error: null }; },
    };
    const db = { from: () => query };

    const alerts = await loadUserPaymentAlerts(db, {
      userId: 'user-1',
      locale: 'pt',
      now: new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(eqCalls).toContainEqual(['user_id', 'user-1']);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      bookingId: 'own-booking',
      kind: 'installment',
      amountDue: 700,
      daysUntilDue: 3,
      paymentUrl: '/peregrinacoes/inscricao/own-booking',
    });
  });
});
