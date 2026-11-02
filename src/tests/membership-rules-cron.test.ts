import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  members: [] as any[],
  reminder: vi.fn(),
  revoked: vi.fn(),
  updates: [] as any[],
  sentRecords: new Set<string>(),
}));

vi.mock('../lib/supabase', () => ({
  supabaseServer: {
    from: () => ({
      select: () => ({ not: () => Promise.resolve({ data: mocks.members, error: null }) }),
      update: (values: any) => {
        mocks.updates.push(values);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  },
}));
vi.mock('../lib/email', () => ({ sendQuotaReminderEmail: mocks.reminder, sendMembershipRevokedEmail: mocks.revoked }));
vi.mock('../lib/email-notifications', () => ({
  ensureNotificationRecord: vi.fn(async (_db: any, input: any) => ({
    shouldSend: !mocks.sentRecords.has(input.reference),
    recordId: input.reference,
  })),
  markNotificationSent: vi.fn(async (_db: any, id: string) => {
    mocks.sentRecords.add(id);
  }),
}));

import { GET } from '../app/api/cron/membership-rules/route';

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const member = (id: string, due: number, estado: string, extra: any = {}) => ({
  id, nome: `M ${id}`, email: `${id}@gmail.com`, numero_socio: id, proxima_quota: isoDay(due),
  estado_quota: estado, tipo_subscricao: 'anual', is_membro: estado === 'pago', country: 'PT', ...extra,
});

const run = async () => {
  process.env.CRON_SECRET = 'segredo-teste';
  const response = await GET(new Request('http://localhost/api/cron/membership-rules', { headers: { authorization: 'Bearer segredo-teste' } }));
  return response.json();
};

beforeEach(() => {
  mocks.members = [];
  mocks.reminder.mockReset().mockResolvedValue(true);
  mocks.revoked.mockReset().mockResolvedValue(true);
  mocks.updates = [];
  mocks.sentRecords = new Set();
});

describe('membership-rules cron', () => {
  it('reminds PAID members as their due date approaches (they are the ones who renew)', async () => {
    mocks.members = [member('a', 20, 'pago')];
    await run();
    expect(mocks.reminder).toHaveBeenCalledTimes(1);
    expect(mocks.reminder.mock.calls[0][0]).toMatchObject({ toEmail: 'a@gmail.com', daysUntilDue: 20 });
  });

  it('stays quiet while the due date is far away', async () => {
    mocks.members = [member('a', 60, 'pago')];
    await run();
    expect(mocks.reminder).not.toHaveBeenCalled();
  });

  it('catches up the 7-day reminder when a cron day was missed, and never repeats it', async () => {
    mocks.members = [member('a', 5, 'pago')];
    await run();
    await run();
    expect(mocks.reminder).toHaveBeenCalledTimes(1);
  });

  it('sends the expiry notice within two weeks of expiring, even if the first day was missed', async () => {
    mocks.members = [member('a', -4, 'expirado')];
    await run();
    expect(mocks.revoked).toHaveBeenCalledTimes(1);
  });

  it('does not email members revoked by an admin or long expired', async () => {
    mocks.members = [member('a', 10, 'revogado'), member('b', -40, 'expirado')];
    await run();
    expect(mocks.reminder).not.toHaveBeenCalled();
    expect(mocks.revoked).not.toHaveBeenCalled();
  });

  it('does not mark the notice as sent when the email fails, so the next run retries', async () => {
    mocks.members = [member('a', 20, 'pago')];
    mocks.reminder.mockResolvedValueOnce(false);
    await run();
    await run();
    expect(mocks.reminder).toHaveBeenCalledTimes(2);
  });
});
