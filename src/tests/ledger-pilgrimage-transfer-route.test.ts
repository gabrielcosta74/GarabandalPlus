import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), assess: vi.fn(), audit: vi.fn() }));
vi.mock('../lib/ledger/server', () => ({
  db: () => ({ from: mocks.from, rpc: mocks.rpc }),
  requireAdmin: async () => ({ ok: true, email: 'admin@example.com', userId: '33333333-3333-4333-8333-333333333333' }),
}));
vi.mock('../lib/ledger/invoice-assessment', () => ({ assessInvoice: mocks.assess }));
vi.mock('../lib/ledger/aliases', () => ({ learnCounterparty: async () => undefined, forgetConfirmation: async () => undefined }));
vi.mock('../lib/ledger/factpt-mirror', () => ({ findMirrorAmount: async () => null }));
vi.mock('../lib/admin-audit', () => ({ logAdminAudit: mocks.audit }));

import { POST } from '../app/api/admin/contabilidade/movimentos/[id]/peregrinacao/route';

const id = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id }) };
const request = (body: unknown) => new Request(`http://localhost/api/admin/contabilidade/movimentos/${id}/peregrinacao`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assess.mockResolvedValue({ issued: null, pending: null, ambiguous: false, nearbyIssuedCount: 0 });
  mocks.rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null });
  mocks.audit.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => ({
    select() { return this; }, eq() { return this; },
    async maybeSingle() {
      return { data: table === 'bank_transactions'
        ? { id, amount: 50, booking_date: '2026-10-18', counterparty_name: 'Maria Costa', status: 'suggested' }
        : { auto_enabled: true, production_pilgrimages_only: true, pilot_private_only: false, go_live_at: '2026-07-01T00:00:00Z' }, error: null };
    },
  }));
});

describe('register a pilgrimage bank transfer', () => {
  it('registers the chosen booking through one RPC and starts the existing fiscal flow', async () => {
    const response = await POST(request({ bookingId }), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_register_pilgrimage_transfer', {
      p_transaction_id: id, p_booking_id: bookingId, p_payment_id: null,
      p_admin_user_id: '33333333-3333-4333-8333-333333333333', p_actor: 'admin@example.com',
    });
  });

  it('requires choosing the matching pending payment instead of creating another', async () => {
    mocks.assess.mockResolvedValue({ issued: null, pending: { type: 'pilgrimage_payment', id: 'payment-1' }, ambiguous: false, nearbyIssuedCount: 0 });
    const response = await POST(request({ bookingId }), context);
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('treats a retry for the same reservation as success without creating another payment', async () => {
    mocks.from.mockImplementation((table: string) => ({
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: table === 'bank_transactions'
        ? { id, amount: 50, booking_date: '2026-10-18', counterparty_name: 'Maria Costa', status: 'suggested' }
        : table === 'bank_transaction_links' ? { target_id: '44444444-4444-4444-8444-444444444444' }
          : { booking_id: bookingId }, error: null }; },
    }));
    const response = await POST(request({ bookingId }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).alreadyRegistered).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses to register a payment when production invoicing is disabled', async () => {
    mocks.from.mockImplementation((table: string) => ({
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: table === 'bank_transactions'
        ? { id, amount: 50, booking_date: '2026-10-18', counterparty_name: 'Maria Costa', status: 'suggested' }
        : { auto_enabled: false }, error: null }; },
    }));
    const response = await POST(request({ bookingId }), context);
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
