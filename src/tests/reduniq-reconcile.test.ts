import { afterEach, describe, expect, it, vi } from 'vitest';

import { reduniqClient } from '../lib/reduniq/client';
import {
  classifyRow,
  loadPendingRows,
  requireManualFactPtApproval,
  type ReconcileRow,
} from '../lib/reduniq-reconcile';

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

function fakeSupabase(result: QueryResult) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'eq', 'like', 'gte', 'lte']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);

  return {
    calls,
    client: {
      from(table: string) {
        calls.push(['from', table]);
        return builder;
      },
    },
  };
}

describe('Reduniq pending reconciliation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    'reduniq_card',
    'reduniq_mbway',
    'reduniq_pix',
    'reduniq_multibanco',
  ])('loads a pending pilgrimage paid through %s', async (method) => {
    const fake = fakeSupabase({
      data: [{
        id: 'payment-1',
        booking_id: 'booking-1',
        user_id: 'user-1',
        amount: 0.5,
        status: 'pending',
        method,
        payment_intent_id: 'token-1',
        external_reference: 'pil-test-1',
        notes: null,
        created_at: '2026-07-29T10:00:00.000Z',
      }],
      error: null,
    });

    const rows = await loadPendingRows(fake.client as never, {
      kinds: ['pilgrimage'],
      minAgeMinutes: 30,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'pilgrimage',
      order_ref: 'pil-test-1',
      amount: 0.5,
    });
    expect(fake.calls).toContainEqual(['like', 'method', 'reduniq%']);
    expect(fake.calls.some(([methodName]) => methodName === 'gte')).toBe(false);
  });

  it('fails the cron visibly when Supabase cannot load pending payments', async () => {
    const fake = fakeSupabase({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(
      loadPendingRows(fake.client as never, {
        kinds: ['pilgrimage'],
      }),
    ).rejects.toThrow(
      /Falha ao carregar pagamentos de peregrinação pendentes: database unavailable/,
    );
  });

  it('only applies a lookback when explicitly requested', async () => {
    const fake = fakeSupabase({ data: [], error: null });

    await loadPendingRows(fake.client as never, {
      kinds: ['pilgrimage'],
      windowDays: 30,
    });

    expect(fake.calls.some(
      ([methodName, column]) => methodName === 'gte' && column === 'created_at',
    )).toBe(true);
  });

  it('surfaces gateway outages as cron errors instead of a false success', async () => {
    vi.spyOn(reduniqClient, 'getOrderStatus').mockResolvedValue({
      success: false,
      error: 'gateway unavailable',
    });
    vi.spyOn(reduniqClient, 'searchTransactions').mockResolvedValue({
      ok: false,
      status: 503,
      error: 'gateway unavailable',
    });
    const row: ReconcileRow = {
      kind: 'pilgrimage',
      id: 'payment-1',
      user_id: 'user-1',
      order_ref: 'pil-test-1',
      token: 'token-1',
      amount: 0.5,
      raw: { booking_id: 'booking-1' },
    };

    await expect(classifyRow(row)).resolves.toMatchObject({
      classification: 'REDUNIQ_ERROR',
      error: 'gateway unavailable',
      errorDisposition: 'retry',
      applied: false,
    });
  });

  it('sends an invalid historic token to review without blocking the batch', async () => {
    vi.spyOn(reduniqClient, 'getOrderStatus').mockResolvedValue({
      success: false,
      error: 'Invalid token',
      resultCode: '00100007',
    });
    vi.spyOn(reduniqClient, 'searchTransactions').mockResolvedValue({
      ok: true,
      status: 200,
      data: { transactions: [] },
    });
    const row: ReconcileRow = {
      kind: 'donation',
      id: 'donation-1',
      user_id: 'user-1',
      order_ref: 'reduniq-old-reference',
      token: 'invalid-old-token',
      amount: 1,
      raw: {},
    };

    await expect(classifyRow(row)).resolves.toMatchObject({
      classification: 'REDUNIQ_ERROR',
      error: 'Invalid token',
      errorDisposition: 'review',
      applied: false,
    });
  });

  it('keeps a failed fallback search retryable even after an invalid token', async () => {
    vi.spyOn(reduniqClient, 'getOrderStatus').mockResolvedValue({
      success: false,
      error: 'Invalid token',
      resultCode: '00100007',
    });
    vi.spyOn(reduniqClient, 'searchTransactions').mockResolvedValue({
      ok: false,
      status: 503,
      error: 'gateway unavailable',
    });
    const row: ReconcileRow = {
      kind: 'pilgrimage',
      id: 'payment-1',
      user_id: 'user-1',
      order_ref: 'pilgrimage-reference',
      token: 'invalid-token',
      amount: 10,
      raw: { booking_id: 'booking-1' },
    };

    await expect(classifyRow(row)).resolves.toMatchObject({
      classification: 'REDUNIQ_ERROR',
      error: 'gateway unavailable',
      errorDisposition: 'retry',
      applied: false,
    });
  });

  it.each([
    ['donation', 'donations'],
    ['quota', 'pagamentos_quotas'],
    ['pilgrimage', 'pilgrimage_payments'],
    ['store', 'store_orders'],
  ] as const)(
    'marks a reconciled %s for manual fiscal approval before confirming it',
    async (kind, expectedTable) => {
      const calls: Array<[string, ...unknown[]]> = [];
      const builder = {
        update(value: unknown) {
          calls.push(['update', value]);
          return this;
        },
        eq(...args: unknown[]) {
          calls.push(['eq', ...args]);
          return this;
        },
        select(...args: unknown[]) {
          calls.push(['select', ...args]);
          return this;
        },
        async maybeSingle() {
          return { data: { id: 'payment-1' }, error: null };
        },
      };
      const client = {
        from(table: string) {
          calls.push(['from', table]);
          return builder;
        },
      };
      const row: ReconcileRow = {
        kind,
        id: 'payment-1',
        order_ref: 'payment-reference',
        token: 'payment-token',
        amount: 10,
        raw: {},
      };

      await requireManualFactPtApproval(client as never, row);

      expect(calls).toContainEqual(['from', expectedTable]);
      expect(calls).toContainEqual([
        'update',
        { factpt_review_required: true },
      ]);
      expect(calls).toContainEqual(['eq', 'id', 'payment-1']);
    },
  );

  it('does not confirm a payment when the fiscal review marker cannot be saved', async () => {
    const builder = {
      update() {
        return this;
      },
      eq() {
        return this;
      },
      select() {
        return this;
      },
      async maybeSingle() {
        return { data: null, error: { message: 'database unavailable' } };
      },
    };
    const client = {
      from() {
        return builder;
      },
    };
    const row: ReconcileRow = {
      kind: 'pilgrimage',
      id: 'payment-1',
      order_ref: 'payment-reference',
      token: 'payment-token',
      amount: 10,
      raw: {},
    };

    await expect(
      requireManualFactPtApproval(client as never, row),
    ).rejects.toThrow(
      /Falha ao colocar pilgrimage em revisão fiscal manual: database unavailable/,
    );
  });
});
