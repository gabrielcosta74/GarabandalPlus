import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  assess: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('../lib/ledger/server', () => ({
  db: () => ({ from: mocks.from, rpc: mocks.rpc }),
  requireAdmin: async () => ({ ok: true, email: 'admin@example.com' }),
}));
vi.mock('../lib/ledger/invoice-assessment', () => ({ assessInvoice: mocks.assess }));
vi.mock('../lib/admin-audit', () => ({ logAdminAudit: mocks.audit }));

import { PATCH } from '../app/api/admin/contabilidade/movimentos/[id]/route';

const id = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id }) };
const movement = {
  id, amount: 50, booking_date: '2026-10-18', counterparty_name: 'Maria Helena Costa',
  status: 'suggested', category_code: null, needs_document: false, paper_document: false,
};
const assessment = { issued: null, pending: null, ambiguous: false, nearbyIssuedCount: 0 };

function request(body: unknown) {
  return new Request(`http://localhost/api/admin/contabilidade/movimentos/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assess.mockResolvedValue(assessment);
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.audit.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: movement, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: table === 'factpt_documents' ? [] : null, error: null }),
    };
    return chain;
  });
});

describe('ledger approval invoice guard', () => {
  it('blocks a pending site payment before any ledger write', async () => {
    mocks.assess.mockResolvedValue({ ...assessment, pending: { type: 'donation', id: 'payment-1' } });
    const response = await PATCH(request({ action: 'approve', categoryCode: 'doacao', invoiceRef: 'FR 2026D/1234' }), context);
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects a FR from the wrong series', async () => {
    const response = await PATCH(request({ action: 'approve', categoryCode: 'quota', invoiceRef: 'FR 2026D/1234' }), context);
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('links the unique existing app FR without requesting a new one', async () => {
    mocks.assess.mockResolvedValue({ ...assessment, issued: { id: 'doc-1', number: 'FR 2026D/1234' }, nearbyIssuedCount: 1 });
    const response = await PATCH(request({ action: 'approve', categoryCode: 'doacao' }), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_approve_movement', {
      p_transaction_id: id,
      p_category_code: 'doacao',
      p_invoice_ref: 'FR 2026D/1234',
      p_invoice_method: 'rule',
      p_actor: 'admin@example.com',
    });
  });

  it('requires explicit review when another app FR has a nearby amount and date', async () => {
    mocks.assess.mockResolvedValue({ ...assessment, nearbyIssuedCount: 1 });
    const response = await PATCH(request({ action: 'approve', categoryCode: 'doacao', invoiceRef: 'FR 2026D/1234' }), context);
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
