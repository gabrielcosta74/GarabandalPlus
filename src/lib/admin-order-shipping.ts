export type ShipOrderBody = {
  shippingStatus?: string;
  tracking?: string | null;
  carrier?: string | null;
  carrierName?: string | null;
};

export type StoreOrderItemForEmail = {
  name: string;
  qty: number;
  unit_price: number;
};

type EmbeddedStoreOrderItem = {
  name?: unknown;
  qty?: unknown;
  unit_price?: unknown;
};

const cleanText = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function buildShipOrderUpdate(body: ShipOrderBody, shippedAt = new Date().toISOString()) {
  const tracking = cleanText(body.tracking);
  const carrierId = cleanText(body.carrier);
  const carrierName = cleanText(body.carrierName);

  if (body.shippingStatus !== 'enviado') {
    throw new Error('Dados inválidos');
  }

  return {
    updatePayload: {
      shipping_status: 'enviado',
      shipping_tracking: tracking,
      shipping_carrier: carrierName || carrierId,
      shipped_at: shippedAt,
    },
    emailPayload: {
      tracking,
      carrierId,
      carrierName: carrierName || carrierId,
      shippedAt,
    },
  };
}

export function omitShippingCarrier<T extends { shipping_carrier?: string | null }>(payload: T) {
  const next = { ...payload };
  delete next.shipping_carrier;
  return next;
}

export function isMissingShippingCarrierColumnError(error: { code?: unknown; message?: unknown } | null | undefined) {
  if (!error) return false;

  const code = String(error.code || '');
  const message = String(error.message || '');

  return (code === '42703' || code === 'PGRST204') && /shipping_carrier/i.test(message);
}

export function getEmbeddedStoreOrderItems(order: { items?: unknown; store_order_items?: unknown }) {
  const rawItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.store_order_items)
      ? order.store_order_items
      : [];

  return rawItems.map((item: EmbeddedStoreOrderItem): StoreOrderItemForEmail => ({
    name: String(item?.name || ''),
    qty: Number(item?.qty || 0),
    unit_price: Number(item?.unit_price || 0),
  }));
}
