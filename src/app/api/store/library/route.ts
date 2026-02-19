import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { products as catalogProducts } from '../../../../lib/store-catalog';
import { createDigitalAccessToken } from '../../../../lib/store-access';
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
      .from('store_digital_access')
      .update({ user_id: userId })
      .is('user_id', null)
      .ilike('buyer_email', email);
  } catch (err) {
    console.warn('Não foi possível associar acessos digitais ao utilizador:', err);
  }

  const { data: accessRows, error: accessError } = await supabaseServer
    .from('store_digital_access')
    .select('id, order_ref, product_id, status, qty, file_url, created_at, last_access_at, download_count')
    .or(`user_id.eq.${userId},buyer_email.ilike.${email}`)
    .order('created_at', { ascending: false });

  if (accessError) {
    console.error('Erro ao listar biblioteca:', accessError);
    return NextResponse.json({ message: 'Erro ao carregar biblioteca.' }, { status: 500 });
  }

  const productIds = (accessRows || []).map((row) => row.product_id);
  const { data: productRows } = productIds.length
    ? await supabaseServer
        .from('store_products')
        .select('product_id, name, image_url, digital_url, is_physical')
        .in('product_id', productIds)
    : { data: [] };

  const productMap = new Map(
    (productRows || []).map((row) => [row.product_id, row]),
  );
  const catalogMap = new Map(
    (catalogProducts || []).map((p) => [p.id, p]),
  );

  // Count purchases from paid orders (source of truth), not only from access rows.
  const paidStatuses = ['paid', 'pago', 'succeeded'];
  let paidOrderQtyByProduct = new Map<string, number>();
  let paidOrderCountByProduct = new Map<string, number>();
  try {
    const { data: paidOrders } = await supabaseServer
      .from('store_orders')
      .select('order_ref')
      .or(`buyer_user_id.eq.${userId},buyer_email.ilike.${email}`)
      .in('status', paidStatuses);

    const paidRefs = Array.from(new Set((paidOrders || []).map((row) => row.order_ref).filter(Boolean)));
    if (paidRefs.length) {
      const { data: paidItems } = await supabaseServer
        .from('store_order_items')
        .select('order_ref, product_id, qty')
        .in('order_ref', paidRefs);

      const refsByProduct = new Map<string, Set<string>>();
      for (const item of paidItems || []) {
        const pid = String(item.product_id || '');
        if (!pid) continue;
        const qty = Math.max(0, Number(item.qty || 0));
        paidOrderQtyByProduct.set(pid, (paidOrderQtyByProduct.get(pid) || 0) + qty);
        const set = refsByProduct.get(pid) || new Set<string>();
        if (item.order_ref) set.add(String(item.order_ref));
        refsByProduct.set(pid, set);
      }
      paidOrderCountByProduct = new Map(
        Array.from(refsByProduct.entries()).map(([pid, refs]) => [pid, refs.size]),
      );
    }
  } catch (err) {
    console.warn('Não foi possível calcular contagem de compras pagas da biblioteca:', err);
  }

  const rowsByProduct = new Map<string, typeof accessRows>();
  for (const row of accessRows || []) {
    const key = row.product_id;
    const bucket = rowsByProduct.get(key) || [];
    bucket.push(row);
    rowsByProduct.set(key, bucket);
  }

  const items = await Promise.all(Array.from(rowsByProduct.entries()).map(async ([productId, rows]) => {
    const sorted = [...rows].sort((a, b) => {
      const ad = new Date(a.created_at || '').getTime();
      const bd = new Date(b.created_at || '').getTime();
      return bd - ad;
    });
    const latest = sorted[0];
    const earliest = sorted[sorted.length - 1];
    const product = productMap.get(productId);
    const catalogProduct = catalogMap.get(productId);
    const purchaseCountFromAccess = rows.reduce((sum, row) => sum + Math.max(1, Number(row.qty || 1)), 0);
    const orderCountFromAccess = new Set(rows.map((row) => row.order_ref)).size;
    const purchaseCount = paidOrderQtyByProduct.get(productId) || purchaseCountFromAccess;
    const orderCount = paidOrderCountByProduct.get(productId) || orderCountFromAccess;
    const downloadCount = rows.reduce((sum, row) => sum + Number(row.download_count ?? 0), 0);

    let downloadUrl: string | null = null;
    try {
      const tokenInfo = await createDigitalAccessToken(supabaseServer, {
        orderRef: latest.order_ref,
        productId,
        buyerEmail: email,
        expiresInDays: 7,
      });
      downloadUrl = `/api/store/download?token=${tokenInfo.token}`;
    } catch (err) {
      downloadUrl = null;
    }

    return {
      id: productId,
      orderRef: latest.order_ref,
      productId,
      status: latest.status,
      qty: purchaseCount,
      purchaseCount,
      orderCount,
      // Product digital_url is source of truth; per-access file_url may contain stale legacy values.
      fileUrl: product?.digital_url || latest.file_url || catalogProduct?.digitalUrl || null,
      downloadUrl,
      createdAt: earliest.created_at,
      firstPurchasedAt: earliest.created_at,
      lastPurchasedAt: latest.created_at,
      lastAccessAt: latest.last_access_at,
      downloadCount,
      product: product
        ? {
            name: product.name || productId,
            image: product.image_url || '',
            format: product.is_physical ? 'Produto físico' : 'PDF digital',
          }
        : {
            name: productId,
            image: '',
            format: 'PDF',
          },
    };
  }));

  const sortedItems = items.sort((a, b) => new Date(b.lastPurchasedAt || 0).getTime() - new Date(a.lastPurchasedAt || 0).getTime());

  return NextResponse.json({ items: sortedItems });
}
