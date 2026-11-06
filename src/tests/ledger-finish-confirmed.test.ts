import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  movements: [] as Record<string, unknown>[],
  links: [] as Record<string, unknown>[],
  document: null as Record<string, unknown> | null,
  rpc: vi.fn(),
  updates: [] as Record<string, unknown>[],
}));

const chain = (result: unknown) => {
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in']) self[method] = () => self;
  self.maybeSingle = async () => ({ data: result, error: null });
  self.then = (resolve: (value: unknown) => void) => resolve({ data: result, error: null });
  return self;
};

vi.mock('../lib/ledger/server', () => ({
  db: () => ({
    rpc: state.rpc,
    from: (table: string) => {
      if (table === 'bank_transaction_links') return chain(state.links);
      if (table === 'factpt_documents') return chain(state.document);
      const query = chain(state.movements);
      return { ...query, select: () => query, update: (patch: Record<string, unknown>) => { state.updates.push(patch); return { eq: async () => ({ error: null }) }; } };
    },
  }),
}));

import { closeInvoicedMovements } from '../lib/ledger/finish-confirmed';

beforeEach(() => {
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ error: null });
  state.updates = [];
  state.movements = [{ id: 'm1', reviewed_by: 'admin@example.com', raw: { close_when_invoiced: true, other: 1 } }];
  state.links = [{ target_type: 'donation', target_id: 'd1' }];
  state.document = { factpt_number: 'FR 2026D/9', status: 'issued' };
});

describe('closing a movement once its FR exists', () => {
  it('closes it with that FR, under the name of who decided', async () => {
    await expect(closeInvoicedMovements()).resolves.toEqual({ closed: 1 });
    expect(state.rpc).toHaveBeenCalledWith('ledger_approve_movement', expect.objectContaining({
      p_transaction_id: 'm1', p_category_code: 'doacao', p_invoice_ref: 'FR 2026D/9', p_actor: 'admin@example.com',
    }));
  });

  it('removes the mark, so reopening later is not undone', async () => {
    await closeInvoicedMovements();
    expect(state.updates[0]).toEqual({ raw: { other: 1 } });
  });

  it('waits while the FR is still being issued', async () => {
    state.document = { factpt_number: null, status: 'pending' };
    await expect(closeInvoicedMovements()).resolves.toEqual({ closed: 0 });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('leaves a failed FR for the admin', async () => {
    state.document = { factpt_number: null, status: 'failed' };
    await closeInvoicedMovements();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('uses the pilgrimage category for a booking payment', async () => {
    state.links = [{ target_type: 'pilgrimage_payment', target_id: 'p1' }];
    await closeInvoicedMovements();
    expect(state.rpc.mock.calls[0][1]).toMatchObject({ p_category_code: 'peregrinacao' });
  });
});
