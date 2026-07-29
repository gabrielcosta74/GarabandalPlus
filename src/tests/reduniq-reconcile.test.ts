import { afterEach, describe, expect, it, vi } from 'vitest';

import { reduniqClient } from '../lib/reduniq/client';
import {
  classifyRow,
  loadPendingRows,
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
      applied: false,
    });
  });
});
