import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

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
  const email = userData.user.email;
  if (!email) {
    return NextResponse.json({ message: 'Email de utilizador em falta.' }, { status: 400 });
  }

  try {
    await supabaseServer
      .from('store_digital_access')
      .update({ user_id: userId })
      .is('user_id', null)
      .eq('buyer_email', email);
  } catch (err) {
    console.warn('Não foi possível associar acessos digitais ao utilizador:', err);
  }

  const { data: accessRows, error: accessError } = await supabaseServer
    .from('store_digital_access')
    .select('id, order_ref, product_id, status, qty, file_url, created_at, last_access_at, download_count')
    .or(`user_id.eq.${userId},buyer_email.eq.${email}`)
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
  const items = (accessRows || []).map((row) => {
    const product = productMap.get(row.product_id);
    return {
      id: row.id,
      orderRef: row.order_ref,
      productId: row.product_id,
      status: row.status,
      qty: row.qty,
      fileUrl: row.file_url || product?.digital_url || null,
      createdAt: row.created_at,
      lastAccessAt: row.last_access_at,
      downloadCount: row.download_count ?? 0,
      product: product
        ? {
            name: product.name || row.product_id,
            image: product.image_url || '',
            format: product.is_physical ? 'Produto físico' : 'PDF digital',
          }
        : {
            name: row.product_id,
            image: '',
            format: 'PDF',
          },
    };
  });

  return NextResponse.json({ items });
}
