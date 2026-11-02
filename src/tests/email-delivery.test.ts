import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test_key';
  return { send: vi.fn() };
});

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendDonationReceiptEmail, sendQuotaReminderEmail } from '../lib/email';

beforeEach(() => {
  mocks.send.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('transactional senders report provider errors', () => {
  const reminder = { toEmail: 'a@gmail.com', memberName: 'Ana', memberNumber: '1', nextQuotaDate: '2027-01-31', membershipUrl: 'https://x.pt', daysUntilDue: 7 };

  it('returns true when Resend accepts the email', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'em_1' }, error: null });
    expect(await sendQuotaReminderEmail(reminder as any)).toBe(true);
  });

  it('returns false when Resend answers with an error (instead of reporting success)', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: 'domain not verified', name: 'validation_error' } });
    expect(await sendQuotaReminderEmail(reminder as any)).toBe(false);
  });

  it('returns false when the request itself throws', async () => {
    mocks.send.mockRejectedValue(new Error('network down'));
    expect(await sendDonationReceiptEmail({ toEmail: 'a@gmail.com', amount: 10 } as any)).toBe(false);
  });
});
