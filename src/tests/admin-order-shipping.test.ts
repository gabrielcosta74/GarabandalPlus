import { describe, expect, it } from 'vitest';
import {
  buildShipOrderUpdate,
  getEmbeddedStoreOrderItems,
  isMissingShippingCarrierColumnError,
  omitShippingCarrier,
} from '../lib/admin-order-shipping';

describe('admin order shipping helpers', () => {
  it('builds a shipped update with trimmed tracking and carrier details', () => {
    const result = buildShipOrderUpdate({
      shippingStatus: 'enviado',
      tracking: '  CT123456789PT  ',
      carrier: ' ctt ',
      carrierName: ' CTT Encomendas ',
    }, '2026-07-10T12:00:00.000Z');

    expect(result.updatePayload).toEqual({
      shipping_status: 'enviado',
      shipping_tracking: 'CT123456789PT',
      shipping_carrier: 'CTT Encomendas',
      shipped_at: '2026-07-10T12:00:00.000Z',
    });
    expect(result.emailPayload).toEqual({
      tracking: 'CT123456789PT',
      carrierId: 'ctt',
      carrierName: 'CTT Encomendas',
      shippedAt: '2026-07-10T12:00:00.000Z',
    });
  });

  it('rejects non-shipped statuses', () => {
    expect(() => buildShipOrderUpdate({ shippingStatus: 'pendente' })).toThrow('Dados inválidos');
  });

  it('can remove the optional carrier column for databases that have not applied that migration', () => {
    expect(omitShippingCarrier({
      shipping_status: 'enviado',
      shipping_tracking: 'CT123456789PT',
      shipping_carrier: 'CTT Encomendas',
      shipped_at: '2026-07-10T12:00:00.000Z',
    })).toEqual({
      shipping_status: 'enviado',
      shipping_tracking: 'CT123456789PT',
      shipped_at: '2026-07-10T12:00:00.000Z',
    });
  });

  it('detects missing shipping_carrier errors from Postgres and PostgREST schema cache', () => {
    expect(isMissingShippingCarrierColumnError({
      code: '42703',
      message: 'column "shipping_carrier" of relation "store_orders" does not exist',
    })).toBe(true);

    expect(isMissingShippingCarrierColumnError({
      code: 'PGRST204',
      message: "Could not find the 'shipping_carrier' column of 'store_orders' in the schema cache",
    })).toBe(true);

    expect(isMissingShippingCarrierColumnError({
      code: 'PGRST204',
      message: "Could not find the 'other_column' column of 'store_orders' in the schema cache",
    })).toBe(false);
  });

  it('reads order items from either embedded Supabase shape', () => {
    expect(getEmbeddedStoreOrderItems({
      items: [{ name: 'Livro', qty: '2', unit_price: '12.5' }],
    })).toEqual([{ name: 'Livro', qty: 2, unit_price: 12.5 }]);

    expect(getEmbeddedStoreOrderItems({
      store_order_items: [{ name: 'Terço', qty: 1, unit_price: 7 }],
    })).toEqual([{ name: 'Terço', qty: 1, unit_price: 7 }]);
  });
});
