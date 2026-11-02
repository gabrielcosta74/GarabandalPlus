import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnsubscribeToken } from '../lib/unsubscribe-token';

const state = vi.hoisted(() => ({
  ops: [] as Array<{ table: string; op: string; values?: any }>,
}));

vi.mock('../lib/supabase', () => {
  const client = {
    from: (table: string) => {
      const chain: any = {
        upsert: (values: any) => {
          state.ops.push({ table, op: 'upsert', values });
          return Promise.resolve({ error: null });
        },
        update: (values: any) => {
          state.ops.push({ table, op: 'update', values });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return chain;
    },
  };
  return { supabaseServer: client };
});

import { GET, POST } from '../app/api/marketing/unsubscribe/route';
import CancelarSubscricaoPage from '../app/cancelar-subscricao/page';

const link = (email = 'maria@gmail.com') => {
  const { e, t } = createUnsubscribeToken(email);
  return { e, t, query: `e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}` };
};

beforeEach(() => {
  state.ops = [];
});

describe('marketing unsubscribe', () => {
  it('does not unsubscribe on GET (link scanners) and redirects to the confirmation page', async () => {
    const response = await GET(new Request(`http://localhost/api/marketing/unsubscribe?${link().query}`));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/cancelar-subscricao');
    expect(state.ops).toHaveLength(0);
  });

  it('unsubscribes on POST (RFC 8058 one-click) and updates contact and newsletter right away', async () => {
    const response = await POST(new Request(`http://localhost/api/marketing/unsubscribe?${link().query}`, { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(state.ops.find((o) => o.table === 'marketing_suppression_list')?.values).toMatchObject({
      normalized_email: 'maria@gmail.com',
      reason: 'unsubscribe',
    });
    expect(state.ops.find((o) => o.table === 'marketing_contacts')?.values).toMatchObject({ consent_state: 'unsubscribed' });
    expect(state.ops.find((o) => o.table === 'newsletter_subscribers')?.values).toMatchObject({ consent_state: 'unsubscribed' });
  });

  it('rejects a tampered token', async () => {
    const { e } = link();
    const response = await POST(new Request(`http://localhost/api/marketing/unsubscribe?e=${e}&t=falso`, { method: 'POST' }));
    expect(response.status).toBe(400);
    expect(state.ops).toHaveLength(0);
  });

  it('shows a confirmation button instead of unsubscribing when the page is opened', async () => {
    const { e, t } = link();
    const element: any = await CancelarSubscricaoPage({ searchParams: Promise.resolve({ e, t }) });
    expect(element.props.status).toBe('confirm');
    expect(state.ops).toHaveLength(0);
  });

  it('unsubscribes only after the confirm step', async () => {
    const { e, t } = link();
    const element: any = await CancelarSubscricaoPage({ searchParams: Promise.resolve({ e, t, confirm: '1' }) });
    expect(element.props.status).toBe('success');
    expect(state.ops.some((o) => o.table === 'marketing_suppression_list')).toBe(true);
  });
});
