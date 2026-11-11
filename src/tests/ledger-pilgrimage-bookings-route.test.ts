import { describe, expect, it, vi } from 'vitest';

const paymentId = '11111111-1111-4111-8111-111111111111';
const pilgrimageId = '22222222-2222-4222-8222-222222222222';
const linkQuery = vi.hoisted(() => vi.fn());

vi.mock('../lib/ledger/server', () => ({
  requireAdmin: async () => ({ ok: true }),
  db: () => ({
    from(table: string) {
      const query = {
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        in(column: string, values: string[]) {
          if (table === 'bank_transaction_links') linkQuery(column, values);
          return this;
        },
        then(resolve: (value: unknown) => void) {
          const data = table === 'bookings' ? [{
            id: 'booking-1', status: 'confirmed', user_id: null, total_amount: 300,
            paid_amount: 100, pilgrims: [], pilgrimage_payments: [{
              id: paymentId, amount: 100, method: 'bank_transfer', status: 'verified',
              created_at: '2026-10-01', deleted: false, billing_name: 'Maria',
            }],
          }] : table === 'bank_transaction_links' ? [{ target_id: paymentId }] : [];
          resolve({ data, error: null });
        },
      };
      return query;
    },
  }),
}));

import { GET } from '../app/api/admin/contabilidade/peregrinacoes/route';

describe('pilgrimage bookings for a bank movement', () => {
  it('marks an equal instalment already linked to another movement', async () => {
    linkQuery.mockClear();
    const response = await GET(new Request(`http://localhost/api/admin/contabilidade/peregrinacoes?pilgrimageId=${pilgrimageId}&amount=100`));
    expect(response.status).toBe(200);
    expect(linkQuery).toHaveBeenCalledWith('target_id', [paymentId]);
    const body = await response.json();
    expect(body.bookings[0].payments[0].linkedToBankMovement).toBe(true);
  });
});
