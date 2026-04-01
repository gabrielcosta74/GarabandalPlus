import { describe, expect, it } from 'vitest';
import {
  buildEmailActivitySummary,
  getEmailStatusLabel,
  inferEmailCategory,
  normalizeResendEmailActivityItem,
} from '../lib/resend-email-activity';

describe('resend email activity helpers', () => {
  it('infers pilgrimage and member categories from subjects', () => {
    expect(inferEmailCategory('Lembrete de pagamento da peregrinação: Garabandal')).toBe('pilgrimages');
    expect(inferEmailCategory('Recibo de Quota')).toBe('members');
    expect(inferEmailCategory('Encomenda enviada com tracking')).toBe('store');
  });

  it('normalizes resend email payloads and status labels', () => {
    const email = normalizeResendEmailActivityItem({
      id: 'mail_123',
      to: ['maria@example.com'],
      from: 'Apostolado <no-reply@example.com>',
      subject: 'Confirmação de Inscrição',
      created_at: '2026-04-01T10:00:00.000Z',
      last_event: 'opened',
    });

    expect(email.category).toBe('pilgrimages');
    expect(email.categoryLabel).toBe('Peregrinações & Leads');
    expect(getEmailStatusLabel(email.lastEvent)).toBe('Aberto');
  });

  it('builds a simple summary grouped by system', () => {
    const summary = buildEmailActivitySummary([
      normalizeResendEmailActivityItem({
        id: '1',
        to: ['a@example.com'],
        from: 'Apostolado <no-reply@example.com>',
        subject: 'Lembrete de pagamento da peregrinação',
        created_at: '2026-04-01T10:00:00.000Z',
        last_event: 'delivered',
      }),
      normalizeResendEmailActivityItem({
        id: '2',
        to: ['b@example.com'],
        from: 'Apostolado <no-reply@example.com>',
        subject: 'Recibo de Quota',
        created_at: '2026-04-01T11:00:00.000Z',
        last_event: 'opened',
      }),
      normalizeResendEmailActivityItem({
        id: '3',
        to: ['c@example.com'],
        from: 'Apostolado <no-reply@example.com>',
        subject: 'Recibo de Quota',
        created_at: '2026-04-01T12:00:00.000Z',
        last_event: 'failed',
      }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.delivered).toBe(1);
    expect(summary.opened).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.systems[0]?.label).toBe('Membros & Quotas');
    expect(summary.systems[0]?.count).toBe(2);
  });
});
