import { sendStoreBuyerEmail, sendStoreOwnerEmail, sendStorePreparingEmail } from './email';
import { ensureNotificationRecord, markNotificationSent } from './email-notifications';
import { createDigitalAccessToken, createOrderAccessToken } from './store-access';
import { getShippingCost } from './shipping-rules';
import { getAppUrl } from './config';
import { normalizeEmail } from './normalize';
import { inferIsDigitalProduct } from './product-kind';

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
  type_id: string | null;
  category?: string | null;
  digital_url: string | null;
  stock?: number | null;
};

const resolveAuthUserByEmail = async (
  supabaseServer: any,
  email: string,
): Promise<{ exists: boolean; userId: string | null }> => {
  try {
    const perPage = 200;
    let page = 1;
    while (true) {
      const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage });
      if (error) return { exists: false, userId: null };
      const users = data?.users || [];
      const match = users.find((u: any) => (u?.email || '').toLowerCase() === email.toLowerCase());
      if (match) return { exists: true, userId: match?.id || null };
      if (users.length < perPage) break;
      page += 1;
    }
    return { exists: false, userId: null };
  } catch {
    return { exists: false, userId: null };
  }
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
  const buyerEmailResolved = normalizedBuyerEmail || '';
  const authUserMatch = buyerEmailResolved
    ? await resolveAuthUserByEmail(supabaseServer, buyerEmailResolved)
    : { exists: false, userId: null };
  const resolvedBuyerUserId = existingOrder.buyer_user_id || authUserMatch.userId || null;

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
      buyer_user_id: resolvedBuyerUserId,
      total_amount: totalAmount,
      shipping_status: shouldSetShippingStatus,
    })
    .eq('order_ref', orderRef);

  // If the order was just paid for the first time, deduct the reserved store credits permanently.
  if (existingOrder.status !== 'paid' && Number(existingOrder.store_credits_used) > 0 && resolvedBuyerUserId) {
    try {
      const { data: deductSuccess, error: deductError } = await supabaseServer.rpc('deduct_store_credits', {
        p_user_id: resolvedBuyerUserId,
        p_amount: Number(existingOrder.store_credits_used)
      });
      if (deductError || !deductSuccess) {
        console.error(`Failed to deduct ${existingOrder.store_credits_used} store credits from user ${resolvedBuyerUserId} for order ${orderRef}`, deductError);
      } else {
        console.log(`Successfully deducted ${existingOrder.store_credits_used} credits for order ${orderRef}`);
      }
    } catch (err) {
      console.error('Exception while deducting store credits in webhook:', err);
    }
  }

  if (existingOrder.status === 'paid') {
    const siteUrl = getAppUrl();
    let hasDigitalExisting = false;
    let digitalDownloadLinks: Array<{ name: string; url: string }> = [];
    try {
      const { data: digitalAccess } = await supabaseServer
        .from('store_digital_access')
        .select('product_id')
        .eq('order_ref', orderRef)
        .order('created_at', { ascending: false });
      const accessRows = digitalAccess || [];
      hasDigitalExisting = accessRows.length > 0;

      if (resolvedBuyerUserId) {
        await supabaseServer
          .from('store_digital_access')
          .update({ user_id: resolvedBuyerUserId })
          .eq('order_ref', orderRef)
          .is('user_id', null);
      }

      if (hasDigitalExisting && buyerEmailResolved) {
        const { data: orderItems } = await supabaseServer
          .from('store_order_items')
          .select('product_id, name')
          .eq('order_ref', orderRef);
        const nameMap = new Map<string, string>(
          (orderItems || []).map((row: any) => [String(row.product_id), String(row.name || row.product_id)]),
        );

        for (const access of accessRows) {
          try {
            const productId = String((access as any).product_id || '');
            if (!productId) continue;
            try {
              const tokenInfo = await createDigitalAccessToken(supabaseServer, {
                orderRef,
                productId,
                buyerEmail: buyerEmailResolved,
                expiresInDays: 7,
              });
              digitalDownloadLinks.push({
                name: nameMap.get(productId) || 'Produto digital',
                url: `${siteUrl}/api/store/download?token=${tokenInfo.token}`,
              });
            } catch (err) {
              console.warn(`Nao foi possivel gerar link digital para pedido pago ${orderRef}, produto ${productId}:`, err);
            }
          } catch (loopErr) {
            console.error(`Erro inesperado no loop de geração de tokens para ${orderRef}:`, loopErr);
          }
        }
      }
    } catch (err) {
      hasDigitalExisting = false;
    }
    return {
      digitalDownloadLinks,
      buyerEmail: existingOrder.buyer_email || buyerEmail || '',
      accountExists: authUserMatch.exists || !!resolvedBuyerUserId,
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
      .select('product_id, is_physical, type_id, category, digital_url')
      .in('product_id', productIds)
    : { data: [] };

  const productMap = new Map<string, StoreProductRow>(
    ((productRows || []) as StoreProductRow[]).map((row) => [row.product_id, row]),
  );

  const isProductDigital = (product?: StoreProductRow | null) => {
    if (!product) return false;
    return inferIsDigitalProduct({
      isPhysical: product.is_physical,
      typeId: product.type_id,
      category: product.category,
      name: null,
      digitalUrl: product.digital_url,
    });
  };

  const digitalItems = itemRows.filter((item) => {
    const product = productMap.get(item.product_id);
    return isProductDigital(product);
  });

  if (digitalItems.length) {
    const accessRows = digitalItems.map((item) => {
      const product = productMap.get(item.product_id);
      return {
        order_ref: orderRef,
        product_id: item.product_id,
        buyer_email: existingOrder.buyer_email || buyerEmail || '',
        user_id: resolvedBuyerUserId,
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

  const accountExists: boolean | null = authUserMatch.exists || !!resolvedBuyerUserId;
  let claimUrl: string | null = null;
  const shouldShowClaimCta = !!buyerEmailResolved && !resolvedBuyerUserId;
  if (shouldShowClaimCta) {
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
        items: itemRows.map((item) => ({
          name: item.name || 'Produto',
          qty: item.qty,
          unit_price: item.unit_price,
        })),
        hasDigital,
        claimUrl,
        downloadLinks: digitalDownloadLinks,
        buyerNif: existingOrder.buyer_nif || null,
        accountExists,
        showClaimCta: shouldShowClaimCta,
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
          .select('stock, is_physical, type_id, category, digital_url')
          .eq('product_id', item.product_id)
          .maybeSingle();

        const digital = isProductDigital(productRow as StoreProductRow | null);
        if (!digital && typeof productRow?.stock === 'number') {
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
