import { describe, expect, it } from 'vitest';
import { resolveReminderCandidate } from '../lib/pilgrimage-payment-reminders';
import { renderPilgrimagePaymentReminderEmail } from '../lib/email-renderer';

describe('pilgrimage payment reminders', () => {
  it('creates a 7 day reminder for the next unpaid installment', () => {
    const candidate = resolveReminderCandidate(
      {
        id: 'booking-1',
        user_id: 'user-1',
        created_at: '2026-03-01T10:00:00.000Z',
        total_amount: 1750,
        paid_amount: 500,
        status: 'confirmed',
        view_token: 'token-123',
        payment_plan: [
          { date: '2026-04-10T10:00:00.000Z', amount: 625 },
          { date: '2026-05-10T10:00:00.000Z', amount: 625 },
        ],
        pilgrimage: {
          title: 'Garabandal Outubro',
          deposit_value: 500,
        },
        pilgrims: [{ full_name: 'Maria', email: 'maria@example.com', birth_date: '1990-01-01' }],
        payments: [
          {
            id: 'pay-1',
            amount: 500,
            status: 'verified',
            method: 'stripe',
            created_at: '2026-03-01T10:05:00.000Z',
          },
        ],
      },
      {
        email: 'maria@example.com',
        recipientName: 'Maria',
        appUrl: 'https://apostoladodegarabandal.com',
        now: new Date('2026-04-03T12:00:00.000Z'),
      },
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.stage.kind).toBe('upcoming_7d');
    expect(candidate?.obligationKey).toBe('installment_1');
    expect(candidate?.remainingAmount).toBe(625);
    expect(candidate?.bookingUrl).toContain('/peregrinacoes/inscricao/booking-1?viewToken=');
  });

  it('suppresses reminders when a receipt is awaiting validation for the same amount', () => {
    const candidate = resolveReminderCandidate(
      {
        id: 'booking-2',
        user_id: 'user-2',
        created_at: '2026-03-01T10:00:00.000Z',
        total_amount: 1750,
        paid_amount: 500,
        status: 'confirmed',
        view_token: 'token-456',
        payment_plan: [{ date: '2026-04-10T10:00:00.000Z', amount: 625 }],
        pilgrimage: {
          title: 'Garabandal Outubro',
          deposit_value: 500,
        },
        pilgrims: [{ full_name: 'Ana', email: 'ana@example.com', birth_date: '1992-02-02' }],
        payments: [
          {
            id: 'pay-1',
            amount: 500,
            status: 'verified',
            method: 'stripe',
            created_at: '2026-03-01T10:05:00.000Z',
          },
          {
            id: 'pay-2',
            amount: 625,
            status: 'pending_verification',
            method: 'bank_transfer',
            created_at: '2026-04-02T10:05:00.000Z',
            receipt_url: 'receipts/booking-2/proof.pdf',
          },
        ],
      },
      {
        email: 'ana@example.com',
        recipientName: 'Ana',
        appUrl: 'https://apostoladodegarabandal.com',
        now: new Date('2026-04-03T12:00:00.000Z'),
      },
    );

    expect(candidate).toBeNull();
  });

  it('creates a short-deadline reminder for the unpaid deposit inside the 5 day window', () => {
    const candidate = resolveReminderCandidate(
      {
        id: 'booking-3a',
        user_id: 'user-3',
        created_at: '2026-03-01T10:00:00.000Z',
        total_amount: 1200,
        paid_amount: 0,
        status: 'pending',
        view_token: 'token-789',
        payment_plan: [{ date: '2026-04-10T10:00:00.000Z', amount: 700 }],
        pilgrimage: {
          title: 'Garabandal Maio',
          deposit_value: 500,
        },
        pilgrims: [{ full_name: 'João', email: 'joao@example.com', birth_date: '1988-03-03' }],
        payments: [],
      },
      {
        email: 'joao@example.com',
        recipientName: 'João',
        appUrl: 'https://apostoladodegarabandal.com',
        now: new Date('2026-03-03T12:00:00.000Z'),
      },
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.stage.kind).toBe('upcoming_3d');
    expect(candidate?.obligationKey).toBe('deposit');
    expect(candidate?.remainingAmount).toBe(500);
  });

  it('creates an overdue reminder for the unpaid deposit after the 5 day deadline', () => {
    const candidate = resolveReminderCandidate(
      {
        id: 'booking-3',
        user_id: 'user-3',
        created_at: '2026-03-01T10:00:00.000Z',
        total_amount: 1200,
        paid_amount: 0,
        status: 'pending',
        view_token: 'token-789',
        payment_plan: [{ date: '2026-04-10T10:00:00.000Z', amount: 700 }],
        pilgrimage: {
          title: 'Garabandal Maio',
          deposit_value: 500,
        },
        pilgrims: [{ full_name: 'João', email: 'joao@example.com', birth_date: '1988-03-03' }],
        payments: [],
      },
      {
        email: 'joao@example.com',
        recipientName: 'João',
        appUrl: 'https://apostoladodegarabandal.com',
        now: new Date('2026-03-11T12:00:00.000Z'),
      },
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.stage.kind).toBe('overdue_5d');
    expect(candidate?.obligationKey).toBe('deposit');
    expect(candidate?.remainingAmount).toBe(500);
  });

  it('renders the reminder email with a direct booking CTA link', () => {
    const bookingUrl =
      'https://apostoladodegarabandal.com/peregrinacoes/inscricao/booking-cta?viewToken=secure123&token=secure123';

    const email = renderPilgrimagePaymentReminderEmail({
      toEmail: 'maria@example.com',
      recipientName: 'Maria',
      pilgrimageName: 'Garabandal Outubro',
      obligationLabel: 'Prestação 1',
      dueDate: '2026-04-10T10:00:00.000Z',
      amountDue: 625,
      totalRemaining: 1250,
      bookingUrl,
      stage: 'upcoming_7d',
    });

    expect(email.subject).toContain('Garabandal Outubro');
    expect(email.html).toContain('Gerir Inscrição');
    expect(email.html).toContain(`href="${bookingUrl}"`);
    expect(email.html).toContain('Prestação 1');
  });
});
