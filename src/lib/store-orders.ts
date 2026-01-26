import { sendStoreBuyerEmail, sendStoreOwnerEmail, sendStorePreparingEmail } from './email';
import { ensureNotificationRecord, markNotificationSent } from './email-notifications';
import { createDigitalAccessToken, createOrderAccessToken } from './store-access';
import { getShippingCost } from './shipping-rules';
import { getAppUrl } from './config';
import { normalizeEmail } from './normalize';

type ProcessPaidStoreOrderInput = {
  supabaseServer: any;
  orderRef: string;
  amountCents?: number | null;
  paymentReference?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  paymentProvider: string;
  paymentMethod: string;
};

type StoreOrderItemRow = {
  product_id: string;
  name: string | null;
  qty: number;
  unit_price: number;
};

type StoreProductRow = {
  product_id: string;
  is_physical: boolean | null;
  digital_url: string | null;
};

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const getVatRate = (isPhysical?: boolean | null) => (isPhysical === false ? 0.23 : 0.06);

const getVatBreakdown = (value: number, rate: number) => {
  const base = value / (1 + rate);
  const vat = value - base;
  return { base, vat };
};

export const processPaidStoreOrder = async ({
  supabaseServer,
  orderRef,
  amountCents,
  paymentReference,
  buyerName,
  buyerEmail,
  buyerPhone,
  paymentProvider,
  paymentMethod,
}: ProcessPaidStoreOrderInput): Promise<{
  digitalDownloadLinks: Array<{ name: string; url: string }>;
  buyerEmail: string;
  accountExists: boolean;
  hasDigital: boolean;
  hasPhysical: boolean;
}> => {
  const { data: existingOrder, error: orderError } = await supabaseServer
    .from('store_orders')
    .select('*')
    .eq('order_ref', orderRef)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!existingOrder) throw new Error('Pedido não encontrado.');

  const totalAmount = typeof amountCents === 'number' ? amountCents / 100 : existingOrder.total_amount;
  const shouldSetShippingStatus = existingOrder.has_physical ? 'por_enviar' : null;
  const normalizedBuyerEmail = normalizeEmail(existingOrder.buyer_email) || normalizeEmail(buyerEmail);

  await supabaseServer
    .from('store_orders')
    .update({
      status: 'paid',
      payment_provider: paymentProvider,
      payment_method: paymentMethod,
      payment_reference: paymentReference || existingOrder.payment_reference,
      buyer_name: existingOrder.buyer_name || buyerName || null,
      buyer_email: normalizedBuyerEmail,
      buyer_phone: existingOrder.buyer_phone || buyerPhone || null,
      total_amount: totalAmount,
      shipping_status: shouldSetShippingStatus,
    })
    .eq('order_ref', orderRef);

  if (existingOrder.status === 'paid') {
    let hasDigitalExisting = false;
    try {
      const { data: digitalAccess } = await supabaseServer
        .from('store_digital_access')
        .select('id')
        .eq('order_ref', orderRef)
        .limit(1);
      hasDigitalExisting = (digitalAccess || []).length > 0;
    } catch (err) {
      hasDigitalExisting = false;
    }
    return {
      digitalDownloadLinks: [],
      buyerEmail: existingOrder.buyer_email || buyerEmail || '',
      accountExists: !!existingOrder.buyer_user_id,
      hasDigital: hasDigitalExisting,
      hasPhysical: !!existingOrder.has_physical,
    };
  }

  const { data: items } = await supabaseServer
    .from('store_order_items')
    .select('product_id, name, qty, unit_price')
    .eq('order_ref', orderRef);

  const itemRows = (items || []) as StoreOrderItemRow[];
  const productIds = itemRows.map((item) => item.product_id);
  const { data: productRows } = productIds.length
    ? await supabaseServer
      .from('store_products')
      .select('product_id, is_physical, digital_url')
      .in('product_id', productIds)
    : { data: [] };

  const productMap = new Map<string, StoreProductRow>(
    ((productRows || []) as StoreProductRow[]).map((row) => [row.product_id, row]),
  );

  const digitalItems = itemRows.filter((item) => {
    const product = productMap.get(item.product_id);
    return product && product.is_physical === false;
  });

  if (digitalItems.length) {
    const accessRows = digitalItems.map((item) => {
      const product = productMap.get(item.product_id);
      return {
        order_ref: orderRef,
        product_id: item.product_id,
        buyer_email: existingOrder.buyer_email || buyerEmail || '',
        user_id: existingOrder.buyer_user_id || null,
        status: 'available',
        qty: item.qty,
        file_url: product?.digital_url || null,
      };
    });

    await supabaseServer
      .from('store_digital_access')
      .upsert(accessRows, { onConflict: 'order_ref,product_id' });
  }

  const totalText = formatCurrency(totalAmount ?? 0, existingOrder.currency || 'EUR');
  const hasDigital = digitalItems.length > 0;
  const siteUrl = getAppUrl();

  const vatTotals = itemRows.reduce(
    (acc, item) => {
      const product = productMap.get(item.product_id);
      const rate = getVatRate(product?.is_physical);
      const breakdown = getVatBreakdown(item.unit_price * item.qty, rate);
      acc.base += breakdown.base;
      acc.vat += breakdown.vat;
      return acc;
    },
    { base: 0, vat: 0 },
  );

  const subtotalText = formatCurrency(vatTotals.base, existingOrder.currency || 'EUR');
  const vatText = formatCurrency(vatTotals.vat, existingOrder.currency || 'EUR');
  const shippingCostValue = getShippingCost(existingOrder.shipping_country, existingOrder.has_physical) ?? 0;
  const shippingCostText =
    existingOrder.has_physical ? (shippingCostValue === 0 ? 'Grátis' : formatCurrency(shippingCostValue)) : null;

  const buyerEmailResolved = normalizedBuyerEmail || '';
  let accountExists: boolean | null = null;
  if (buyerEmailResolved) {
    try {
      const { data, error } = await supabaseServer.auth.admin.getUserByEmail(buyerEmailResolved);
      accountExists = !error && !!data?.user;
    } catch (err) {
      accountExists = null;
    }
  }
  let claimUrl: string | null = null;
  if (buyerEmailResolved) {
    try {
      const claimTokenInfo = await createOrderAccessToken(supabaseServer, {
        orderRef,
        buyerEmail: buyerEmailResolved,
        expiresInDays: 7,
      });
      claimUrl = `${siteUrl}/loja-online/claim?token=${claimTokenInfo.token}`;
    } catch (err) {
      console.warn('Nao foi possivel gerar link de acesso ao pedido:', err);
    }
  }

  const digitalDownloadLinks: Array<{ name: string; url: string }> = [];
  if (buyerEmailResolved && digitalItems.length) {
    for (const item of digitalItems) {
      try {
        const tokenInfo = await createDigitalAccessToken(supabaseServer, {
          orderRef,
          productId: item.product_id,
          buyerEmail: buyerEmailResolved,
          expiresInDays: 7,
        });
        digitalDownloadLinks.push({
          name: item.name || 'Produto digital',
          url: `${siteUrl}/api/store/download?token=${tokenInfo.token}`,
        });
      } catch (err) {
        console.warn('Nao foi possivel gerar link digital temporario:', err);
      }
    }
  }

  const ownerNotify = await ensureNotificationRecord(supabaseServer, {
    type: 'store_order_owner',
    reference: orderRef,
    email: null,
  });

  if (ownerNotify.shouldSend) {
    await sendStoreOwnerEmail({
      orderRef,
      buyerName: existingOrder.buyer_name || buyerName || null,
      buyerEmail: buyerEmailResolved || null,
      buyerPhone: existingOrder.buyer_phone || buyerPhone || null,
      buyerNif: existingOrder.buyer_nif || null,
      subtotal: subtotalText,
      vat: vatText,
      shippingCost: shippingCostText,
      total: totalText,
      items: itemRows.map((item) => ({
        name: item.name || 'Produto',
        qty: item.qty,
        unit_price: item.unit_price,
      })),
      shipping: existingOrder.has_physical
        ? {
          address1: existingOrder.shipping_address1,
          address2: existingOrder.shipping_address2,
          city: existingOrder.shipping_city,
          postalCode: existingOrder.shipping_postal_code,
          country: existingOrder.shipping_country,
        }
        : null,
      billing: {
        address1: existingOrder.billing_address || null,
        city: existingOrder.billing_city || null,
        postalCode: existingOrder.billing_postal_code || null,
        country: existingOrder.billing_country || null,
      }

    });
    await markNotificationSent(supabaseServer, ownerNotify.recordId);
  }

  if (buyerEmailResolved) {
    const buyerNotify = await ensureNotificationRecord(supabaseServer, {
      type: 'store_order_buyer',
      reference: orderRef,
      email: buyerEmailResolved,
    });

    if (buyerNotify.shouldSend) {
      await sendStoreBuyerEmail({
        orderRef,
        buyerName: existingOrder.buyer_name || buyerName || null,
        buyerEmail: buyerEmailResolved,
        subtotal: subtotalText,
        vat: vatText,
        shippingCost: shippingCostText,
        total: totalText,
        hasDigital,
        claimUrl,
        downloadLinks: digitalDownloadLinks,
        buyerNif: existingOrder.buyer_nif || null,
        accountExists,
        shipping: existingOrder.has_physical
          ? {
            address1: existingOrder.shipping_address1,
            address2: existingOrder.shipping_address2,
            city: existingOrder.shipping_city,
            postalCode: existingOrder.shipping_postal_code,
            country: existingOrder.shipping_country,
          }
          : null,
        billing: {
          address1: existingOrder.billing_address || null,
          city: existingOrder.billing_city || null,
          postalCode: existingOrder.billing_postal_code || null,
          country: existingOrder.billing_country || null,
        }
      });
      await markNotificationSent(supabaseServer, buyerNotify.recordId);
    }
  }

  if (buyerEmailResolved && existingOrder.has_physical) {
    const preparingNotify = await ensureNotificationRecord(supabaseServer, {
      type: 'store_order_preparing',
      reference: orderRef,
      email: buyerEmailResolved,
    });

    if (preparingNotify.shouldSend) {
      await sendStorePreparingEmail({
        orderRef,
        buyerEmail: buyerEmailResolved,
        buyerName: existingOrder.buyer_name || buyerName || null,
      });
      await markNotificationSent(supabaseServer, preparingNotify.recordId);
    }
  }

  if (itemRows.length) {
    for (const item of itemRows) {
      try {
        const { data: productRow } = await supabaseServer
          .from('store_products')
          .select('stock')
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (typeof productRow?.stock === 'number') {
          const newStock = Math.max(productRow.stock - item.qty, 0);
          await supabaseServer
            .from('store_products')
            .update({ stock: newStock })
            .eq('product_id', item.product_id);
        }
      } catch (err) {
        console.error('Erro ao atualizar stock:', err);
      }
    }
  }

  return {
    digitalDownloadLinks,
    buyerEmail: buyerEmailResolved,
    accountExists: !!accountExists,
    hasDigital,
    hasPhysical: !!existingOrder.has_physical,
  };
};
