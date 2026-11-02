import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  contacts: [] as any[],
}));

vi.mock('../lib/marketing-email', () => ({ sendMarketingEmail: mocks.send }));
vi.mock('../lib/marketing-data', () => ({
  buildMarketingContacts: vi.fn(async () => mocks.contacts),
  persistMarketingContacts: vi.fn(async () => ({})),
}));

import { prepareMarketingFunnelEnrollments, processMarketingEnrollment } from '../lib/marketing-automation-engine';

// Cliente falso que regista o que se escreve e devolve respostas por tabela.
const makeSupabase = (opts: { claim?: boolean; referralCode?: string | null; existingEnrollments?: Row[]; persisted?: Row[] } = {}) => {
  const updates: Array<{ table: string; values: Row }> = [];
  const inserts: Array<{ table: string; row: Row }> = [];
  const supabase = {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        gte: () => chain,
        ilike: () => chain,
        limit: () => chain,
        range: () => Promise.resolve({ data: opts.existingEnrollments || [], error: null }),
        maybeSingle: () => Promise.resolve({ data: table === 'membros' && opts.referralCode ? { referral_code: opts.referralCode } : null, error: null }),
        update: (values: Row) => {
          updates.push({ table, values });
          const upd: any = {
            eq: () => upd,
            select: () => Promise.resolve({ data: opts.claim === false ? [] : [{ id: 'enr-1' }], error: null }),
            then: (resolve: any) => resolve({ error: null }),
          };
          return upd;
        },
        insert: (row: Row) => {
          inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        then: (resolve: any) =>
          resolve({ data: table === 'marketing_contacts' ? opts.persisted || [] : [], count: 0, error: null }),
      };
      return chain;
    },
  };
  return { supabase, updates, inserts };
};

const enrollment = (overrides: Row = {}) => ({
  id: 'enr-1',
  current_step: 0,
  status: 'active',
  next_run_at: '2026-11-02T10:00:00+00:00',
  created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  metadata: {},
  funnel: {
    id: 'f1',
    slug: 'test-funnel',
    name: 'Teste',
    segment_slug: null,
    steps: [{ template_key: 'member_welcome', delay_hours: 0 }, { template_key: 'second', delay_hours: 24 }],
  },
  contact: { id: 'c1', normalized_email: 'ana@gmail.com', language: 'pt', consent_state: 'explicit', source_summary: {} },
  ...overrides,
});

beforeEach(() => {
  mocks.send.mockReset();
  mocks.contacts = [];
});

describe('processMarketingEnrollment', () => {
  it('waits for an open spot instead of skipping the recovery step', async () => {
    const { supabase, updates } = makeSupabase();
    const e = enrollment({
      funnel: { id: 'f1', slug: 'recovery', name: 'R', segment_slug: null, steps: [{ template_key: 'abandoned_registration_1', delay_hours: 1, condition: 'not_booked' }, { template_key: 'abandoned_registration_faq', delay_hours: 48 }] },
      contact: { id: 'c1', normalized_email: 'ana@gmail.com', language: 'pt', consent_state: 'explicit', source_summary: { available_pilgrimages: 0, bookings: 0, pilgrims: 0 } },
    });
    const result = await processMarketingEnrollment(supabase, e);
    expect(result).toMatchObject({ status: 'deferred', reason: 'waiting_availability' });
    expect(updates[0].values).toHaveProperty('next_run_at');
    expect(updates[0].values).not.toHaveProperty('current_step');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('gives up waiting for spots after 30 days and moves to the next step', async () => {
    const { supabase, updates } = makeSupabase();
    const e = enrollment({
      created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      funnel: { id: 'f1', slug: 'recovery', name: 'R', segment_slug: null, steps: [{ template_key: 'abandoned_registration_1', delay_hours: 1 }, { template_key: 'abandoned_registration_faq', delay_hours: 48 }] },
      contact: { id: 'c1', normalized_email: 'ana@gmail.com', language: 'pt', consent_state: 'explicit', source_summary: { available_pilgrimages: 0 } },
    });
    const result = await processMarketingEnrollment(supabase, e);
    expect(result).toMatchObject({ status: 'skipped', reason: 'condition_failed' });
    expect(updates.some((u) => u.values.current_step === 1)).toBe(true);
  });

  it('sends with an idempotency key per enrollment and step', async () => {
    mocks.send.mockResolvedValue({ sent: true, providerId: 'em_1', subject: 's', templateKey: 'member_welcome' });
    const { supabase } = makeSupabase();
    const result = await processMarketingEnrollment(supabase, enrollment());
    expect(result).toMatchObject({ status: 'sent' });
    expect(mocks.send.mock.calls[0][0]).toMatchObject({ idempotencyKey: 'funnel-enr-1-step-0' });
  });

  it('passes the member personal invite link to referral emails', async () => {
    mocks.send.mockResolvedValue({ sent: true, providerId: 'em_1', subject: 's', templateKey: 'referral_activation' });
    const { supabase } = makeSupabase({ referralCode: 'MARIA123' });
    const e = enrollment({ funnel: { id: 'f1', slug: 'referral', name: 'Ref', segment_slug: null, steps: [{ template_key: 'referral_activation', delay_hours: 0 }] } });
    await processMarketingEnrollment(supabase, e);
    expect(mocks.send.mock.calls[0][0].context).toMatchObject({ referralCode: 'MARIA123' });
    expect(mocks.send.mock.calls[0][0].context.referralUrl).toContain('/convite/MARIA123');
  });

  it('does not send when another run already claimed the step', async () => {
    const { supabase } = makeSupabase({ claim: false });
    const result = await processMarketingEnrollment(supabase, enrollment());
    expect(result).toMatchObject({ status: 'skipped', reason: 'already_claimed' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('retries a failed send later and only gives up on the third failure', async () => {
    mocks.send.mockResolvedValue({ sent: false, error: 'rate limit' });
    const first = makeSupabase();
    expect(await processMarketingEnrollment(first.supabase, enrollment())).toMatchObject({ status: 'retry_scheduled' });
    expect(first.updates.at(-1)?.values).toMatchObject({ status: 'active', metadata: { send_failures: 1 } });

    const third = makeSupabase();
    const result = await processMarketingEnrollment(third.supabase, enrollment({ metadata: { send_failures: 2 } }));
    expect(result).toMatchObject({ status: 'failed' });
    expect(third.updates.at(-1)?.values).toMatchObject({ status: 'failed' });
  });
});

describe('prepareMarketingFunnelEnrollments', () => {
  const contact = (n: number) => ({
    normalized_email: `p${n}@gmail.com`,
    language: 'pt',
    consent_state: 'explicit',
    segments: ['members-without-referrals'],
    source_summary: {},
  });

  it('enrolls new contacts even when the first ones are already enrolled', async () => {
    mocks.contacts = [1, 2, 3, 4, 5].map(contact);
    const persisted = [1, 2, 3, 4, 5].map((n) => ({ id: `c${n}`, normalized_email: `p${n}@gmail.com` }));
    const { supabase, inserts } = makeSupabase({
      persisted,
      existingEnrollments: [{ id: 'e1', contact_id: 'c1', status: 'active' }, { id: 'e2', contact_id: 'c2', status: 'completed' }, { id: 'e3', contact_id: 'c3', status: 'active' }],
    });
    const result = await prepareMarketingFunnelEnrollments(supabase, { id: 'f1', slug: 'x', segment_slug: 'members-without-referrals', steps: [{ delay_hours: 0 }] }, { limit: 2 });
    expect(result.enrolled).toBe(2);
    expect(inserts.map((i) => i.row.contact_id).sort()).toEqual(['c4', 'c5']);
  });

  it('keeps Spanish and undeliverable contacts out of funnels', async () => {
    mocks.contacts = [
      { ...contact(1), language: 'es' },
      { ...contact(2), normalized_email: 'visitante@chat.local' },
      contact(3),
    ];
    const { supabase, inserts } = makeSupabase({ persisted: [{ id: 'c3', normalized_email: 'p3@gmail.com' }] });
    const result = await prepareMarketingFunnelEnrollments(supabase, { id: 'f1', slug: 'x', segment_slug: 'members-without-referrals', steps: [{ delay_hours: 0 }] });
    expect(result.enrolled).toBe(1);
    expect(inserts[0].row.contact_id).toBe('c3');
  });
});
