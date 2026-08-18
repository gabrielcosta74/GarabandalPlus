import { afterEach, describe, expect, it, vi } from 'vitest';

import { reduniqClient } from '../lib/reduniq/client';
import {
  classifyRow,
  reconciledGatewayAmountCents,
  reconciledPrincipalAmountCents,
  type ReconcileRow,
} from '../lib/reduniq-reconcile';

describe('Reduniq pilgrimage reconciliation amounts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates the gross charge while preserving the booking principal', async () => {
    vi.spyOn(reduniqClient, 'getOrderStatus').mockResolvedValue({
      success: true,
      status: 'success',
      transactionId: 'tx-pilgrimage-1',
      orderRef: 'pilgrimage-reference',
      raw: {
        transaction: { status: '4', id: 'tx-pilgrimage-1' },
        order: { ref: 'pilgrimage-reference', amount: 1_019 },
      },
    });
    const searchSpy = vi.spyOn(reduniqClient, 'searchTransactions');
    const row: ReconcileRow = {
      kind: 'pilgrimage',
      id: 'pilgrimage-payment-1',
      user_id: 'user-1',
      order_ref: 'pilgrimage-reference',
      token: 'pilgrimage-token',
      amount: 10,
      gatewayAmount: 10.19,
      raw: {
        booking_id: 'booking-1',
        amount: 10,
        charged_amount: 10.19,
      },
    };

    await expect(classifyRow(row)).resolves.toMatchObject({
      classification: 'CONFIRMED_PAID',
      gatewayAmountCents: 1_019,
    });
    expect(searchSpy).not.toHaveBeenCalled();
    expect(reconciledPrincipalAmountCents(row)).toBe(1_000);
    expect(reconciledGatewayAmountCents(row)).toBe(1_019);
  });

  it('blocks confirmation when the Reduniq total differs from the gross charge', async () => {
    vi.spyOn(reduniqClient, 'getOrderStatus').mockResolvedValue({
      success: true,
      status: 'success',
      transactionId: 'tx-pilgrimage-2',
      orderRef: 'pilgrimage-reference',
      raw: {
        transaction: { status: '4', id: 'tx-pilgrimage-2' },
        order: { ref: 'pilgrimage-reference', amount: 1_000 },
      },
    });

    await expect(classifyRow({
      kind: 'pilgrimage',
      id: 'pilgrimage-payment-2',
      user_id: 'user-1',
      order_ref: 'pilgrimage-reference',
      token: 'pilgrimage-token',
      amount: 10,
      gatewayAmount: 10.19,
      raw: { booking_id: 'booking-1' },
    })).resolves.toMatchObject({
      classification: 'REDUNIQ_ERROR',
      errorDisposition: 'review',
      gatewayAmountCents: 1_000,
    });
  });
});
