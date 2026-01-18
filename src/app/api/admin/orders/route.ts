import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin-auth';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const { data: orders, error } = await supabaseServer
    .from('store_orders')
    .select(
      'order_ref, buyer_name, buyer_email, buyer_phone, buyer_nif, buyer_user_id, total_amount, currency, status, created_at, payment_provider, payment_method, payment_reference, shipping_address1, shipping_address2, shipping_city, shipping_postal_code, shipping_country, shipping_status, shipping_tracking, shipped_at, has_physical, shipping_cost, shipping_origin, shipping_zone',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao listar pedidos:', error);
    return NextResponse.json({ message: 'Erro ao listar pedidos.' }, { status: 500 });
  }

  const refs = orders?.map((order) => order.order_ref) || [];
  let itemsByOrder: Record<string, any[]> = {};

  if (refs.length) {
    const { data: items, error: itemsError } = await supabaseServer
      .from('store_order_items')
      .select('order_ref, name, qty, unit_price, total_price')
      .in('order_ref', refs);

    if (itemsError) {
      console.error('Erro ao listar itens do pedido:', itemsError);
    } else {
      itemsByOrder = items.reduce<Record<string, any[]>>((acc, item) => {
        acc[item.order_ref] = acc[item.order_ref] || [];
        acc[item.order_ref].push(item);
        return acc;
      }, {});
    }
  }

  const payload = orders.map((order) => ({
    ...order,
    items: itemsByOrder[order.order_ref] || [],
  }));

  return NextResponse.json({ orders: payload });
}
