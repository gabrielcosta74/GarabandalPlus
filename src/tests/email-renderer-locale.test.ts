import { describe, expect, it } from 'vitest';
import {
  renderDonationReceiptEmail,
  renderMemberReceiptEmail,
} from '../lib/email-renderer';

describe('email renderer locale', () => {
  it('renders donation receipts in English when locale is en', () => {
    const email = renderDonationReceiptEmail({
      toEmail: 'donor@example.com',
      donorName: 'John',
      amount: 25,
      currency: 'EUR',
      paymentReference: 'reduniq_test',
      paidAt: '2026-04-19T12:00:00Z',
      method: 'reduniq',
      locale: 'en',
    });

    expect(email.subject).toContain('Donation successfully registered');
    expect(email.html).toContain('Thank you for your generosity');
    expect(email.html).toContain('Amount');
    expect(email.html).not.toContain('Doação registada com sucesso');
  });

  it('renders member receipts in English when locale is en', () => {
    const email = renderMemberReceiptEmail({
      toEmail: 'member@example.com',
      memberName: 'John',
      memberNumber: 123,
      amount: 25,
      currency: 'EUR',
      paymentMethod: 'reduniq',
      paymentReference: 'reduniq_test',
      nextQuotaDate: '2027-04-19',
      paidAt: '2026-04-19T12:00:00Z',
      kind: 'new',
      hasDiploma: true,
      locale: 'en',
    });

    expect(email.subject).toContain('Apostolate Receipt');
    expect(email.html).toContain('Payment Confirmed');
    expect(email.html).toContain('Member Certificate');
    expect(email.html).toContain('/en/member');
    expect(email.html).not.toContain('Pagamento Confirmado');
  });

  it('keeps Portuguese as the default locale', () => {
    const email = renderDonationReceiptEmail({
      toEmail: 'donor@example.com',
      amount: 25,
      currency: 'EUR',
      paymentReference: 'reduniq_test',
      method: 'reduniq',
    });

    expect(email.subject).toContain('Doação registada com sucesso');
    expect(email.html).toContain('Obrigado pela sua generosidade');
  });
});
