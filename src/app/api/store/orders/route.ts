import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { inferIsDigitalProduct } from '../../../../lib/product-kind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getBearerToken = (request: Request) => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
};

export async function GET(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ message: 'Sessão inválida.' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ message: 'Sessão inválida.' }, { status: 401 });
  }

  const userId = userData.user.id;
  const email = normalizeEmail(userData.user.email);
  if (!email) {
    return NextResponse.json({ message: 'Email de utilizador em falta.' }, { status: 400 });
  }

  try {
    await supabaseServer
      .from('store_orders')
      .update({
        buyer_user_id: userId,
        claimed_at: new Date().toISOString(),
        claim_source: 'auto_login',
      })
      .is('buyer_user_id', null)
      .ilike('buyer_email', email);
  } catch (err) {
    console.warn('Nao foi possivel associar pedidos ao utilizador:', err);
  }

  const [byUserResult, byEmailResult] = await Promise.all([
    supabaseServer
      .from('store_orders')
      .select('*')
      .eq('buyer_user_id', userId)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('store_orders')
      .select('*')
      .ilike('buyer_email', email)
      .order('created_at', { ascending: false }),
  ]);

  if (byUserResult.error || byEmailResult.error) {
    console.error('Erro ao listar encomendas:', byUserResult.error || byEmailResult.error);
    return NextResponse.json({ message: 'Erro ao listar encomendas.' }, { status: 500 });
  }

  const orderMap = new Map<string, any>();
  for (const order of [...(byUserResult.data || []), ...(byEmailResult.data || [])]) {
    const ref = String(order.order_ref || '');
    if (!ref) continue;
    const existing = orderMap.get(ref);
    if (!existing) {
      orderMap.set(ref, order);
      continue;
    }
    const existingTime = new Date(existing.created_at || 0).getTime();
    const nextTime = new Date(order.created_at || 0).getTime();
    if (nextTime >= existingTime) orderMap.set(ref, order);
  }

  const orders = Array.from(orderMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );

  const refs = orders.map((order) => order.order_ref) || [];
  let itemsByOrder: Record<string, any[]> = {};
  let productMap = new Map<
    string,
    { is_physical: boolean | null; type_id?: string | null; category?: string | null; digital_url?: string | null }
  >();

  if (refs.length) {
    const { data: items, error: itemsError } = await supabaseServer
      .from('store_order_items')
      .select('order_ref, product_id, name, qty, unit_price, total_price')
      .in('order_ref', refs);

    if (itemsError) {
      console.error('Erro ao listar itens da encomenda:', itemsError);
    } else {
      const productIds = Array.from(new Set(items.map((item) => item.product_id).filter(Boolean)));
      if (productIds.length) {
        const { data: products, error: productsError } = await supabaseServer
          .from('store_products')
          .select('product_id, is_physical, type_id, category, digital_url')
          .in('product_id', productIds);
        if (productsError) {
          console.error('Erro ao listar produtos da encomenda:', productsError);
        } else {
          productMap = new Map(
            (products || []).map((product) => [
              product.product_id,
              {
                is_physical: product.is_physical,
                type_id: (product as any).type_id,
                category: (product as any).category,
                digital_url: (product as any).digital_url,
              },
            ]),
          );
        }
      }

      itemsByOrder = items.reduce<Record<string, any[]>>((acc, item) => {
        const productMeta = productMap.get(item.product_id);
        const inferredDigital = inferIsDigitalProduct({
          isPhysical: productMeta?.is_physical ?? null,
          typeId: productMeta?.type_id ?? null,
          category: productMeta?.category ?? null,
          name: item.name || null,
          digitalUrl: productMeta?.digital_url ?? null,
        });
        const resolvedIsPhysical =
          typeof productMeta?.is_physical === 'boolean'
            ? productMeta.is_physical
            : inferredDigital
              ? false
              : null;

        acc[item.order_ref] = acc[item.order_ref] || [];
        acc[item.order_ref].push({
          ...item,
          is_physical: resolvedIsPhysical,
        });
        return acc;
      }, {});
    }
  }

  const payload = (orders || []).map((order) => {
    const items = itemsByOrder[order.order_ref] || [];
    const hasDigital = items.some((item) => item.is_physical === false);
    const hasPhysical = items.some((item) => item.is_physical !== false);
    return {
      ...order,
      items,
      has_digital: hasDigital,
      has_physical: typeof order.has_physical === 'boolean' ? order.has_physical : hasPhysical,
    };
  });

  return NextResponse.json({ orders: payload });
}
