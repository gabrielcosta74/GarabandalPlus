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
    .select('order_ref, total_amount, status, created_at, shipping_country')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar dashboard:', error);
    return NextResponse.json({ message: 'Erro ao carregar dashboard.' }, { status: 500 });
  }

  const totalOrders = orders.length;
  const paidOrders = orders.filter((order) => order.status === 'paid').length;
  const pendingOrders = orders.filter((order) => order.status === 'pending').length;
  const shippedOrders = orders.filter((order) => order.status === 'shipped').length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const brazilOrders = orders.filter((order) => (order.shipping_country || '').toLowerCase() === 'br').length;

  let lowStock: Array<{ product_id: string; name: string; stock: number }> = [];
  try {
    const { data: products, error: stockError } = await supabaseServer
      .from('store_products')
      .select('product_id, name, stock');
    if (!stockError && products) {
      lowStock = products.filter((product) => (product.stock ?? 0) <= 5);
    }
  } catch (err) {
    console.warn('Tabela store_products não disponível:', err);
  }

  return NextResponse.json({
    totalOrders,
    paidOrders,
    pendingOrders,
    shippedOrders,
    totalRevenue,
    brazilOrders,
    recentOrders: orders.slice(0, 6),
    lowStock,
  });
}
