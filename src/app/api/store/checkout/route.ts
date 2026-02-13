import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '../../../../lib/payments';
import { supabaseServer } from '../../../../lib/supabase';
import { validatePostalCode } from '../../../../lib/country-utils';
import { getShippingCost, getShippingOrigin, getShippingZone, isPhysicalShippingAllowed } from '../../../../lib/shipping-rules';
import { applyMemberDiscount, isActiveMember, MEMBER_DISCOUNT_RATE } from '../../../../lib/store-discounts';
import { getAppUrl } from '../../../../lib/config';
import { normalizeEmail } from '../../../../lib/normalize';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { inferIsDigitalProduct } from '../../../../lib/product-kind';

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  qty: z.number().int().positive(),
});

const isValidNif = (value: string | null | undefined, country: string | null | undefined) => {
  const digits = (value || '').trim();
  if (!digits) return true; // Optional field
  // Relaxed validation: Accept if it has at least 3 chars (to filter out garbage)
  return digits.length >= 3;
};

const bodySchema = z.object({
  items: z.array(itemSchema).min(1),
  total: z.number().positive(),
  provider: z.enum(['stripe', 'reduniq']).default('stripe'),
  reduniqSolution: z.number().int().optional(),
  buyer: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    nif: z.string().optional().nullable(),
    phone: z.string().optional(),
  }),
  shipping: z
    .object({
      address1: z.string().min(1),
      address2: z.string().optional().nullable(),
      doorNumber: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().min(1),
    })
    .nullable()
    .optional(),
  billing: z.object({
    address1: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }),
});


export async function POST(request: Request) {
  try {
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}`;
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    const json = await request.json();
    const { items, total, provider, reduniqSolution, buyer, shipping, billing } = bodySchema.parse(json);
    const buyerEmail = normalizeEmail(buyer.email);

    const normalizedItems = items.map((item) => ({ id: item.id, qty: item.qty }));

    if (!supabaseServer) {
      return NextResponse.json(
        { message: 'Nao foi possivel validar produtos.', code: 'PRODUCTS_UNAVAILABLE', requestId },
        { status: 500 },
      );
    }

    let buyerUserId: string | null = null;
    let sessionEmail: string | null = null;
    let memberDiscountRate = 0;

    if (bearerToken) {
      const { data: userData } = await supabaseServer.auth.getUser(bearerToken);
      if (userData?.user) {
        buyerUserId = userData.user.id;
        sessionEmail = userData.user.email ?? null;
      }
    }

    if (buyerUserId) {
      const { data: member } = await supabaseServer
        .from('membros')
        .select('is_membro, estado_quota, tipo_subscricao, proxima_quota')
        .eq('id', buyerUserId)
        .maybeSingle();
      if (isActiveMember(member)) {
        memberDiscountRate = MEMBER_DISCOUNT_RATE;
      }
    }

    const normalizedSessionEmail = normalizeEmail(sessionEmail);
    if (normalizedSessionEmail && buyerEmail && normalizedSessionEmail !== buyerEmail) {
      return NextResponse.json(
        { message: 'O email do comprador deve coincidir com o email da conta.', code: 'EMAIL_MISMATCH', requestId },
        { status: 400 },
      );
    }

    if (!isValidNif(buyer.nif, shipping?.country || '')) {
      return NextResponse.json(
        {
          message: shipping?.country === 'BR' ? 'CPF invalido. Usa 11 digitos.' : 'NIF invalido. Usa 9 digitos.',
          code: 'NIF_INVALID',
          requestId,
        },
        { status: 400 },
      );
    }

    const { data: productRows, error: productError } = await supabaseServer
      .from('store_products')
      .select('product_id, name, category, price, is_physical, is_active, stock, allowed_countries, type_id, digital_url')
      .in(
        'product_id',
        normalizedItems.map((item) => item.id),
      );

    if (productError) {
      return NextResponse.json(
        { message: 'Nao foi possivel validar produtos.', code: 'PRODUCTS_UNAVAILABLE', requestId },
        { status: 500 },
      );
    }

    const safeItems = normalizedItems.map((item) => {
      const product = productRows?.find((entry) => entry.product_id === item.id);
      if (!product || product.is_active === false) return null;
      const basePrice = Number(product.price ?? 0);
      const price = applyMemberDiscount(basePrice, memberDiscountRate > 0);
      const isDigital = inferIsDigitalProduct({
        isPhysical: product.is_physical,
        typeId: (product as any).type_id,
        category: (product as any).category,
        name: product.name,
        digitalUrl: (product as any).digital_url,
      });
      const isPhysical = !isDigital;
      return {
        id: product.product_id,
        name: product.name || 'Produto',
        price,
        qty: item.qty,
        isPhysical,
        stock: isPhysical && typeof product.stock === 'number' ? product.stock : null,
        allowedCountries: product.allowed_countries,
      };
    });

    if (safeItems.some((item) => item === null)) {
      return NextResponse.json(
        { message: 'Existe um produto invalido no carrinho.', code: 'INVALID_ITEM', requestId },
        { status: 400 },
      );
    }

    const itemsResolved = safeItems.filter(Boolean) as Array<{
      id: string;
      name: string;
      price: number;
      qty: number;
      isPhysical: boolean;
      stock: number | null;
      allowedCountries: string[] | null;
    }>;

    const hasPhysical = itemsResolved.some((item) => item.isPhysical);
    const shippingCost = getShippingCost(shipping?.country, hasPhysical);
    if (hasPhysical && !isPhysicalShippingAllowed(shipping?.country)) {
      return NextResponse.json(
        { message: 'Envio físico disponível apenas para Portugal e Brasil.', code: 'SHIPPING_BLOCKED', requestId },
        { status: 400 },
      );
    }

    // START: Dynamic Country Availability Check
    if (hasPhysical && shipping?.country) {
      const countryCode = shipping.country.toUpperCase();
      const blockedProduct = itemsResolved.find((item) => {
        if (!item.isPhysical) return false;
        // If allowedCountries is defined and not empty, enforce it.
        // If null or empty, it falls back to standard rules (PT/BR checked above).
        if (item.allowedCountries && item.allowedCountries.length > 0) {
          return !item.allowedCountries.includes(countryCode);
        }
        return false;
      });

      if (blockedProduct) {
        return NextResponse.json(
          {
            message: `O produto "${blockedProduct.name}" não envia para o seu país (${shipping.country}).`,
            code: 'SHIPPING_COUNTRY_RESTRICTED',
            requestId
          },
          { status: 400 },
        );
      }
    }
    // END: Dynamic Country Availability Check

    if (hasPhysical && shippingCost === null) {
      return NextResponse.json(
        { message: 'Não foi possível calcular os portes para o país selecionado.', code: 'SHIPPING_INVALID', requestId },
        { status: 400 },
      );
    }
    const computedTotal = itemsResolved.reduce((sum, item) => sum + item.price * item.qty, 0) + (shippingCost || 0);
    const roundedTotal = Math.round(computedTotal * 100) / 100;
    const roundedSent = Math.round(total * 100) / 100;

    if (roundedTotal !== roundedSent) {
      return NextResponse.json(
        { message: 'Total inválido.', code: 'TOTAL_MISMATCH', requestId },
        { status: 400 },
      );
    }

    if (hasPhysical && !shipping) {
      return NextResponse.json(
        { message: 'Morada obrigatória para envio físico.', code: 'SHIPPING_REQUIRED', requestId },
        { status: 400 },
      );
    }

    if (shipping && !validatePostalCode(shipping.country, shipping.postalCode)) {
      return NextResponse.json(
        { message: 'Código postal de envio inválido.', code: 'POSTAL_INVALID', requestId },
        { status: 400 },
      );
    }
    if (!validatePostalCode(billing.country, billing.postalCode)) {
      return NextResponse.json(
        { message: 'Código postal de faturação inválido.', code: 'POSTAL_INVALID', requestId },
        { status: 400 },
      );
    }

    const orderRef = `store_${Date.now()}`;
    const paymentProvider = provider === 'reduniq' ? 'reduniq' : 'stripe';
    const paymentMethod = provider === 'reduniq' ? 'reduniq' : 'stripe_checkout';
    const metadata = {
      type: 'store',
      orderRef,
      itemCount: String(itemsResolved.reduce((sum, item) => sum + item.qty, 0)),
      cartTotal: String(roundedTotal),
      buyerEmail: buyerEmail || buyer.email,
      buyerName: buyer.fullName,
      shippingCountry: shipping?.country ?? '',
      shippingPostalCode: shipping?.postalCode ?? '',
      shippingDoor: shipping?.doorNumber ?? '',
      hasPhysical: hasPhysical ? '1' : '0',
      shippingCost: String(shippingCost || 0),
      shippingZone: getShippingZone(shipping?.country),
      shippingOrigin: getShippingOrigin(shipping?.country),
      memberDiscount: memberDiscountRate ? String(memberDiscountRate) : '',
      paymentProvider,
    };

    if (supabaseServer) {
      try {
        try {
          for (const item of itemsResolved) {
            if (item.isPhysical && typeof item.stock === 'number' && item.stock < item.qty) {
              return NextResponse.json(
                { message: `Stock insuficiente para ${item.name}.`, code: 'INSUFFICIENT_STOCK', requestId },
                { status: 400 },
              );
            }
          }
        } catch (stockErr) {
          console.warn('Nao foi possivel validar stock:', stockErr);
        }

        const { error: orderError } = await supabaseServer.from('store_orders').insert({
          order_ref: orderRef,
          buyer_name: buyer.fullName,
          buyer_email: buyerEmail || buyer.email,
          buyer_nif: buyer.nif?.trim() || null,
          buyer_phone: buyer.phone || null,
          buyer_user_id: buyerUserId,
          total_amount: roundedTotal,
          currency: 'EUR',
          status: 'pending',
          payment_provider: paymentProvider,
          payment_method: paymentMethod,
          shipping_address1: shipping?.address1 ?? null,
          shipping_address2: shipping?.address2 || shipping?.doorNumber
            ? `${shipping?.address2 ?? ''}${shipping?.address2 ? ' ' : ''}Porta ${shipping?.doorNumber ?? ''}`.trim()
            : null,
          shipping_city: shipping?.city ?? null,
          shipping_postal_code: shipping?.postalCode ?? null,
          shipping_country: shipping?.country ?? null,
          shipping_cost: shippingCost || 0,
          shipping_origin: getShippingOrigin(shipping?.country),
          shipping_zone: getShippingZone(shipping?.country),
          has_physical: hasPhysical,
          billing_address: billing.address1,
          billing_city: billing.city,
          billing_postal_code: billing.postalCode,
          billing_country: billing.country,
        });

        if (orderError) {
          throw new Error('Falha ao criar pedido.');
        }

        const { error: itemsError } = await supabaseServer.from('store_order_items').insert(
          itemsResolved.map((item) => ({
            order_ref: orderRef,
            product_id: item.id,
            name: item.name,
            qty: item.qty,
            unit_price: item.price,
            total_price: item.price * item.qty,
          })),
        );

        if (itemsError) {
          throw new Error('Falha ao criar linhas do pedido.');
        }
      } catch (err) {
        console.error('Erro ao guardar pedido no Supabase:', { err, requestId });
        return NextResponse.json(
          { message: 'Nao foi possivel criar o pedido.', code: 'ORDER_CREATE_FAILED', requestId },
          { status: 500 },
        );
      }
    }

    const siteUrl = getAppUrl();

    if (provider === 'reduniq') {
      const successUrl = `${siteUrl}/thank-you?type=store&amount=${roundedTotal}&provider=reduniq&orderRef=${orderRef}&status=success`;
      const cancelUrl = `${siteUrl}/thank-you?type=store&amount=${roundedTotal}&provider=reduniq&orderRef=${orderRef}&status=failed&canceled=true`;
      const countryCode = (shipping?.country || billing?.country || 'PT').slice(0, 2).toUpperCase();
      const languageCode = countryCode === 'PT' || countryCode === 'BR' ? 'por' : 'eng';
      const itemSummary = itemsResolved
        .slice(0, 3)
        .map((item) => `${item.qty}x ${item.name}`)
        .join(', ');
      const description = `Loja Online: ${itemSummary || 'Pedido'}${itemsResolved.length > 3 ? '...' : ''}`;

      const attemptInit = async (solution?: number) =>
        reduniqClient.initiatePayment({
          amount: roundedTotal,
          orderRef,
          customerName: buyer.fullName,
          customerEmail: buyer.email,
          returnUrlOk: successUrl,
          returnUrlError: cancelUrl,
          notificationUrl: `${siteUrl}/api/webhooks/reduniq`,
          description,
          solution,
          languageCode,
          action: 101,
        });

      let initResult = await attemptInit(reduniqSolution);
      if (!initResult.success && reduniqSolution) {
        const msg = (initResult.error || '').toLowerCase();
        const code = (initResult.resultCode || '').toLowerCase();
        const looksLikeInvalidSolution =
          msg.includes('invalid payment solution') ||
          (msg.includes('invalid parameter') && msg.includes('payment.solution')) ||
          code.startsWith('003');

        if (looksLikeInvalidSolution) {
          console.warn(`[Reduniq][Store] Solution ${reduniqSolution} rejeitada; fallback para terminal geral.`);
          initResult = await attemptInit(undefined);
        }
      }

      if (!initResult.success || !initResult.url) {
        return NextResponse.json(
          { message: initResult.error || 'Falha ao iniciar pagamento Reduniq.', code: 'REDUNIQ_INIT_FAILED', requestId },
          { status: 502 },
        );
      }

      if (supabaseServer) {
        try {
          await supabaseServer
            .from('store_orders')
            .update({
              payment_reference: initResult.token || initResult.transactionId || orderRef,
            })
            .eq('order_ref', orderRef);
        } catch (err) {
          console.warn('Não foi possível guardar referência Reduniq no pedido.', err);
        }
      }

      return NextResponse.json({ url: initResult.url, orderRef, requestId });
    }

    if (!stripe) {
      return NextResponse.json({ message: 'Stripe não configurado.', code: 'STRIPE_MISSING', requestId }, { status: 500 });
    }

    const successUrl = `${siteUrl}/thank-you?type=store&amount=${roundedTotal}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/thank-you?type=store&amount=${roundedTotal}&provider=stripe&status=failed&canceled=true`;

    const lineItems = itemsResolved.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.name,
        },
      },
    }));
    if (shippingCost && shippingCost > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(shippingCost * 100),
          product_data: {
            name: 'Portes de envio',
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      customer_email: buyer.email,
      metadata,
    });

    if (supabaseServer) {
      try {
        await supabaseServer
          .from('store_orders')
          .update({
            payment_reference: session.id,
          })
          .eq('order_ref', orderRef);
      } catch (err) {
        console.warn('Não foi possível guardar referência Stripe no pedido.', err);
      }
    }

    return NextResponse.json({ url: session.url, orderRef, requestId });
  } catch (err: any) {
    console.error('Erro em /api/store/checkout:', err);
    const message = err?.message || 'Erro ao iniciar checkout.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
