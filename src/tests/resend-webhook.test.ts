import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

type Row = Record<string, any>;

// Estado partilhado com o cliente Supabase falso (hoisted para o vi.mock).
const state = vi.hoisted(() => ({
  log: null as any,
  transientCount: 0,
  inserts: [] as Array<{ table: string; row: any }>,
  updates: [] as Array<{ table: string; values: any }>,
  upserts: [] as Array<{ table: string; row: any }>,
}));

vi.mock('../lib/supabase', () => ({
  supabaseServer: {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        maybeSingle: () => Promise.resolve({ data: table === 'marketing_message_logs' ? state.log : null, error: null }),
        update: (values: any) => {
          state.updates.push({ table, values });
          return chain;
        },
        insert: (row: any) => {
          state.inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        upsert: (row: any) => {
          state.upserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        // contagem de bounces transitórios (select head) e updates encadeados
        then: (resolve: any) => resolve({ count: state.transientCount, error: null }),
      };
      return chain;
    },
  },
}));

import { POST } from '../app/api/webhooks/resend/route';

const secret = ['whsec', Buffer.from('local-test-only-signing-key-1234').toString('base64')].join('_');

const call = async (body: Row, svixId = 'msg_1') => {
  const payload = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
    .update(`${svixId}.${timestamp}.${payload}`)
    .digest('base64');
  const response = await POST(
    new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` },
      body: payload,
    }),
  );
  return { status: response.status, body: await response.json() };
};

const bounce = (type: string) => ({
  type: 'email.bounced',
  created_at: '2026-11-02T12:00:00Z',
  data: { email_id: 'em_1', to: ['pessoa@gmail.com'], bounce: { type, message: 'x' } },
});

beforeEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = secret;
  state.log = { id: 'log1', contact_id: 'c1', template_key: 'member_welcome', metadata: {} };
  state.transientCount = 1;
  state.inserts = [];
  state.updates = [];
  state.upserts = [];
});

describe('resend webhook', () => {
  it('rejects an invalid signature', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/resend', {
        method: 'POST',
        headers: { 'svix-id': 'msg_1', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,AAAA' },
        body: '{}',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('records clicks on the message log', async () => {
    const result = await call({ type: 'email.clicked', data: { email_id: 'em_1', to: ['pessoa@gmail.com'], click: { link: 'https://x.pt/a' } } });
    expect(result.status).toBe(200);
    const update = state.updates.find((u) => u.table === 'marketing_message_logs');
    expect(update?.values.metadata).toMatchObject({ click_count: 1, last_click_url: 'https://x.pt/a' });
  });

  it('ignores a retried event with the same svix-id', async () => {
    state.log.metadata = { click_count: 1, event_ids: ['msg_dup'] };
    const result = await call({ type: 'email.clicked', data: { email_id: 'em_1', to: ['pessoa@gmail.com'] } }, 'msg_dup');
    expect(result.body).toMatchObject({ duplicate: true });
    expect(state.updates).toHaveLength(0);
  });

  it('suppresses immediately on a permanent bounce', async () => {
    await call(bounce('Permanent'));
    expect(state.inserts.find((i) => i.table === 'marketing_suppression_list')?.row).toMatchObject({
      normalized_email: 'pessoa@gmail.com',
      reason: 'bounce',
    });
    expect(state.updates.find((u) => u.table === 'marketing_contacts')?.values).toMatchObject({ consent_state: 'suppressed' });
  });

  it('keeps the contact on a first transient bounce', async () => {
    state.transientCount = 1;
    await call(bounce('Transient'));
    expect(state.inserts.find((i) => i.table === 'marketing_suppression_list')).toBeUndefined();
    expect(state.updates.find((u) => u.table === 'marketing_contacts')).toBeUndefined();
  });

  it('suppresses after repeated transient bounces', async () => {
    state.transientCount = 3;
    await call(bounce('Transient'));
    expect(state.inserts.find((i) => i.table === 'marketing_suppression_list')?.row).toMatchObject({
      reason: 'bounce_repeated_transient',
    });
  });

  it('always suppresses spam complaints', async () => {
    await call({ type: 'email.complained', data: { email_id: 'em_1', to: ['pessoa@gmail.com'] } });
    expect(state.inserts.find((i) => i.table === 'marketing_suppression_list')?.row).toMatchObject({ reason: 'spam_complaint' });
  });
});
