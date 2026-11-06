import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), gate: vi.fn(), prefill: vi.fn(), audit: vi.fn(), learn: vi.fn(), mirror: vi.fn(), conflict: vi.fn(), generic: vi.fn() }));
vi.mock('../lib/ledger/server', () => ({
  db: () => ({ from: mocks.from, rpc: mocks.rpc }),
  requireAdmin: async () => ({ ok: true, email: 'admin@example.com', userId: '33333333-3333-4333-8333-333333333333' }),
}));
vi.mock('../lib/ledger/donation-issue', () => ({ donationGate: mocks.gate, donorPrefill: mocks.prefill, clientConflict: mocks.conflict, genericClientExists: mocks.generic }));
vi.mock('../lib/ledger/factpt-mirror', () => ({ syncFactptMirror: mocks.mirror }));
vi.mock('../lib/ledger/aliases', () => ({ learnCounterparty: mocks.learn }));
vi.mock('../lib/ledger/finish-confirmed', () => ({ closeWhenInvoiced: async () => undefined }));
vi.mock('../lib/admin-audit', () => ({ logAdminAudit: mocks.audit }));

import { POST } from '../app/api/admin/contabilidade/movimentos/[id]/doacao/route';

const id = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id }) };
const donor = { name: 'Ana Costa', email: 'ana@example.com', address: 'Rua 1', zip: '1000-001', city: 'Lisboa', country: 'PT' };
const request = (body: unknown) => new Request(`http://localhost/api/admin/contabilidade/movimentos/${id}/doacao`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const movement = (status = 'suggested', amount = '25.00') => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: { id, amount, booking_date: '2026-11-10', counterparty_name: 'Ana Costa', status, account_id: 'a' }, error: null,
  }) }) }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation(() => movement());
  mocks.gate.mockResolvedValue({ available: true, blockedReason: null, nearbyManual: [] });
  mocks.rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null });
  mocks.audit.mockResolvedValue(undefined);
  mocks.learn.mockResolvedValue(undefined);
  mocks.mirror.mockResolvedValue({ pages: 2, documents: 40, clients: 0 });
  mocks.conflict.mockResolvedValue(null);
  mocks.generic.mockResolvedValue(true);
});

describe('donation FR through the app', () => {
  it('issues when every safeguard passes', async () => {
    const response = await POST(request({ donor }), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_register_donation_transfer', expect.objectContaining({
      p_transaction_id: id, p_donor_name: 'Ana Costa', p_donor_email: 'ana@example.com', p_actor: 'admin@example.com',
    }));
    expect(mocks.learn).toHaveBeenCalledWith('Ana Costa', 'doacao');
  });

  it('reads FACT.pt live before deciding, so an FR issued today counts', async () => {
    await POST(request({ donor }), context);
    expect(mocks.mirror.mock.invocationCallOrder[0]).toBeLessThan(mocks.gate.mock.invocationCallOrder[0]);
    expect(mocks.gate.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
  });

  it('issues nothing when FACT.pt cannot be read', async () => {
    mocks.mirror.mockRejectedValue(new Error('timeout'));
    const response = await POST(request({ donor }), context);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('Nada foi emitido');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('stops before issuing when FACT.pt would refuse the client', async () => {
    const existing = { name: 'Ana Costa', email: 'outro@example.com', address: 'Rua 2', zip: '2000-001', city: 'Porto', country: 'PT' };
    mocks.conflict.mockResolvedValue(existing);
    const response = await POST(request({ donor }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).conflict).toEqual(existing);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses incomplete fiscal data before touching anything', async () => {
    const response = await POST(request({ donor: { name: 'Ana Costa' } }), context);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('morada');
    expect(mocks.gate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('never issues when a safeguard blocks it', async () => {
    mocks.gate.mockResolvedValue({ available: false, blockedReason: 'A FR 2026D/9 já foi emitida à mão.', nearbyManual: [] });
    const response = await POST(request({ donor }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('FR 2026D/9');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('needs the admin to rule out a nearby manual FR', async () => {
    mocks.gate.mockResolvedValue({ available: true, blockedReason: null, nearbyManual: ['FR 2026D/9'] });
    expect((await POST(request({ donor }), context)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await POST(request({ donor, acknowledgeManual: true }), context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('issues to Consumidor final with no personal data, up to 100 €', async () => {
    mocks.from.mockImplementation(() => movement('suggested', '100.00'));
    const response = await POST(request({ generic: true }), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_register_generic_donation_transfer', expect.objectContaining({ p_transaction_id: id, p_actor: 'admin@example.com' }));
    expect(mocks.conflict).not.toHaveBeenCalled();
  });

  it('refuses Consumidor final above 100 € before reading anything', async () => {
    mocks.from.mockImplementation(() => movement('suggested', '100.01'));
    const response = await POST(request({ generic: true }), context);
    expect(response.status).toBe(409);
    expect(mocks.mirror).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('keeps every safeguard on the Consumidor final path', async () => {
    mocks.gate.mockResolvedValue({ available: false, blockedReason: 'A FR 2026D/9 já foi emitida à mão.', nearbyManual: [] });
    expect((await POST(request({ generic: true }), context)).status).toBe(409);
    mocks.gate.mockResolvedValue({ available: true, blockedReason: null, nearbyManual: ['FR 2026D/9'] });
    expect((await POST(request({ generic: true }), context)).status).toBe(409);
    mocks.gate.mockResolvedValue({ available: true, blockedReason: null, nearbyManual: [] });
    mocks.generic.mockResolvedValue(false);
    expect((await POST(request({ generic: true }), context)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses a movement already handled', async () => {
    mocks.from.mockImplementation(() => movement('reconciled'));
    expect((await POST(request({ donor }), context)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('reports a second donation for the same movement clearly', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    const response = await POST(request({ donor }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('Já existe uma doação para este movimento.');
  });

  it('keeps only short text from the request', async () => {
    await POST(request({ donor: { ...donor, name: `  ${'A'.repeat(500)}  `, city: { evil: true }, extra: 'x' } }), context);
    expect(mocks.rpc).not.toHaveBeenCalled();
    await POST(request({ donor: { ...donor, name: `  ${'A'.repeat(500)}  ` } }), context);
    expect(mocks.rpc.mock.calls[0][1].p_donor_name).toHaveLength(200);
  });
});
