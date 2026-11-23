import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ order: null as any, handled: 0 }));

vi.mock('../lib/supabase', () => ({
  supabaseServer: {
    from: (table: string) => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: table === 'store_orders' ? state.order : null, error: null }),
      };
      return builder;
    },
  },
}));

vi.mock('../lib/reduniq/client', () => ({
  reduniqClient: {
    getResult: async () => ({
      ok: true,
      data: { result: { code: '00000000' }, transaction: { status: '4', id: 'tx' }, payment: {} },
    }),
    searchTransactions: async () => ({ ok: false }),
  },
}));

vi.mock('../lib/payment-handlers', () => ({
  handleStoreSuccess: async () => {
    state.handled += 1;
    return {
      digitalDownloadLinks: [{ name: 'Livro', url: 'https://site.test/api/store/download?token=t' }],
      buyerEmail: 'ana@example.com', accountExists: true, hasDigital: true, hasPhysical: false,
    };
  },
  handleDonationSuccess: vi.fn(),
  handleMembershipSuccess: vi.fn(),
  handlePilgrimageSuccess: vi.fn(),
  handleAuctionSuccess: vi.fn(),
  handlePaymentFailedOrCanceled: vi.fn(),
}));

import { POST } from '../app/api/reduniq/confirm/route';

const confirm = async (ip: string) => (await POST(new Request('https://site.test/api/reduniq/confirm', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify({ orderRef: 'store_1' }),
}))).json();

const orderFrom = (minutesAgo: number) => ({
  order_ref: 'store_1', total_amount: 5, currency: 'EUR', payment_reference: 'payment-token-1',
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

beforeEach(() => { state.handled = 0; });

describe('store payment confirmation', () => {
  it('shows the buyer their links right after checkout', async () => {
    state.order = orderFrom(5);
    const body = await confirm('1.1.1.1');
    expect(body.digitalDownloadLinks).toHaveLength(1);
    expect(body.buyerEmail).toBe('ana@example.com');
  });

  it('confirms an older order without links or email', async () => {
    state.order = orderFrom(61);
    const body = await confirm('2.2.2.2');
    expect(body).toMatchObject({ success: true, updated: true, hasDigital: true });
    expect(body).not.toHaveProperty('digitalDownloadLinks');
    expect(body).not.toHaveProperty('buyerEmail');
  });

  it('keeps confirming payments but hides the details after many attempts', async () => {
    state.order = orderFrom(5);
    for (let i = 0; i < 10; i += 1) await confirm('3.3.3.3');
    const body = await confirm('3.3.3.3');
    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty('digitalDownloadLinks');
    expect(state.handled).toBe(11);
  });
});
