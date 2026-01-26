import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';

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

  const { data: orders, error } = await supabaseServer
    .from('store_orders')
    .select('*')
    .or(`buyer_email.eq.${email},buyer_email.ilike.${email},buyer_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao listar encomendas:', error);
    return NextResponse.json({ message: 'Erro ao listar encomendas.' }, { status: 500 });
  }

  const refs = orders?.map((order) => order.order_ref) || [];
  let itemsByOrder: Record<string, any[]> = {};
  let productMap = new Map<string, boolean | null>();

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
          .select('product_id, is_physical')
          .in('product_id', productIds);
        if (productsError) {
          console.error('Erro ao listar produtos da encomenda:', productsError);
        } else {
          productMap = new Map(
            (products || []).map((product) => [product.product_id, product.is_physical]),
          );
        }
      }

      itemsByOrder = items.reduce<Record<string, any[]>>((acc, item) => {
        acc[item.order_ref] = acc[item.order_ref] || [];
        acc[item.order_ref].push({
          ...item,
          is_physical: productMap.get(item.product_id) ?? null,
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
