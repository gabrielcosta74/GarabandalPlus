import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '../../../../lib/payments';
import { supabaseServer } from '../../../../lib/supabase';
import { validatePostalCode } from '../../../../lib/country-utils';
import { getShippingCost, getShippingOrigin, getShippingZone, isPhysicalShippingAllowed } from '../../../../lib/shipping-rules';
import { applyMemberDiscount, isActiveMember, MEMBER_DISCOUNT_RATE } from '../../../../lib/store-discounts';
import { getAppUrl } from '../../../../lib/config';

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  qty: z.number().int().positive(),
});

const isValidNif = (value: string | null | undefined, country: string | null | undefined) => {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return true;
  if (country === 'PT') return digits.length === 9;
  if (country === 'BR') return digits.length === 11;
  return digits.length >= 6;
};

const bodySchema = z.object({
  items: z.array(itemSchema).min(1),
  total: z.number().positive(),
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
});


export async function POST(request: Request) {
  try {
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}`;
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    const json = await request.json();
    const { items, total, buyer, shipping } = bodySchema.parse(json);

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
        .select('is_membro, estado_quota, tipo_subscricao')
        .eq('id', buyerUserId)
        .maybeSingle();
      if (isActiveMember(member)) {
        memberDiscountRate = MEMBER_DISCOUNT_RATE;
      }
    }

    if (sessionEmail && sessionEmail.toLowerCase() !== buyer.email.toLowerCase()) {
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
      .select('product_id, name, price, is_physical, is_active, stock')
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
      return {
        id: product.product_id,
        name: product.name || 'Produto',
        price,
        qty: item.qty,
        isPhysical: product.is_physical ?? true,
        stock: typeof product.stock === 'number' ? product.stock : null,
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
    }>;

    const hasPhysical = itemsResolved.some((item) => item.isPhysical);
    const shippingCost = getShippingCost(shipping?.country, hasPhysical);
    if (hasPhysical && !isPhysicalShippingAllowed(shipping?.country)) {
      return NextResponse.json(
        { message: 'Envio físico disponível apenas para países da UE, Brasil e Estados Unidos.', code: 'SHIPPING_BLOCKED', requestId },
        { status: 400 },
      );
    }
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
        { message: 'Código postal inválido para o país selecionado.', code: 'POSTAL_INVALID', requestId },
        { status: 400 },
      );
    }

    const orderRef = `store_${Date.now()}`;
    const metadata = {
      type: 'store',
      orderRef,
      itemCount: String(itemsResolved.reduce((sum, item) => sum + item.qty, 0)),
      cartTotal: String(roundedTotal),
      buyerEmail: buyer.email,
      buyerName: buyer.fullName,
      shippingCountry: shipping?.country ?? '',
      shippingPostalCode: shipping?.postalCode ?? '',
      shippingDoor: shipping?.doorNumber ?? '',
      hasPhysical: hasPhysical ? '1' : '0',
      shippingCost: String(shippingCost || 0),
      shippingZone: getShippingZone(shipping?.country),
      shippingOrigin: getShippingOrigin(shipping?.country),
      memberDiscount: memberDiscountRate ? String(memberDiscountRate) : '',
    };

    if (supabaseServer) {
      try {
        try {
          for (const item of itemsResolved) {
            if (typeof item.stock === 'number' && item.stock < item.qty) {
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
          buyer_email: buyer.email,
          buyer_nif: buyer.nif?.trim() || null,
          buyer_phone: buyer.phone || null,
          buyer_user_id: buyerUserId,
          total_amount: roundedTotal,
          currency: 'EUR',
          status: 'pending',
          payment_provider: 'stripe',
          payment_method: 'stripe_checkout',
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

    if (!stripe) {
      return NextResponse.json({ message: 'Stripe não configurado.', code: 'STRIPE_MISSING', requestId }, { status: 500 });
    }

    const siteUrl = getAppUrl();
    const successUrl = `${siteUrl}/thank-you?type=store&amount=${roundedTotal}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/loja-online/checkout?canceled=true`;

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
