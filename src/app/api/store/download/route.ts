import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { hashAccessToken } from '../../../../lib/store-access';
import { buyerFileUrl, isPaidStoreOrder } from '../../../../lib/store-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) {
    return NextResponse.json({ message: 'Token ausente.' }, { status: 400 });
  }

  const tokenHash = hashAccessToken(token);
  const { data: tokenRow, error: tokenError } = await supabaseServer
    .from('store_digital_access_tokens')
    .select('order_ref, product_id, download_count')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ message: 'Token inválido.' }, { status: 404 });
  }

  // Emailed links do not lapse: the purchase itself is checked on every download,
  // so revoking the access or the payment also stops the link.
  const [accessResult, orderResult] = await Promise.all([
    supabaseServer
      .from('store_digital_access')
      .select('status, file_url, download_count')
      .eq('order_ref', tokenRow.order_ref)
      .eq('product_id', tokenRow.product_id)
      .maybeSingle(),
    supabaseServer
      .from('store_orders')
      .select('status')
      .eq('order_ref', tokenRow.order_ref)
      .maybeSingle(),
  ]);

  if (accessResult.error || orderResult.error) {
    console.error('Erro ao validar compra digital:', accessResult.error || orderResult.error);
    return NextResponse.json({ message: 'Não foi possível validar a compra.' }, { status: 500 });
  }

  const accessRow = accessResult.data;
  if (accessRow?.status !== 'available' || !isPaidStoreOrder(orderResult.data?.status)) {
    return NextResponse.json({ message: 'Compra não confirmada.' }, { status: 403 });
  }

  const { data: productRow } = await supabaseServer
    .from('store_products')
    .select('digital_url')
    .eq('product_id', tokenRow.product_id)
    .maybeSingle();

  // Product digital_url is source of truth. Keep accessRow.file_url only as legacy fallback.
  const fileAddress = productRow?.digital_url || accessRow.file_url || null;
  const fileUrl = fileAddress ? await buyerFileUrl(supabaseServer, fileAddress) : null;

  if (!fileUrl) {
    return NextResponse.json({ message: 'Ficheiro não disponível.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  await supabaseServer
    .from('store_digital_access_tokens')
    .update({
      last_access_at: now,
      download_count: (tokenRow?.download_count ?? 0) + 1,
    })
    .eq('token_hash', tokenHash);

  await supabaseServer
    .from('store_digital_access')
    .update({
      last_access_at: now,
      download_count: (accessRow.download_count ?? 0) + 1,
    })
    .eq('order_ref', tokenRow.order_ref)
    .eq('product_id', tokenRow.product_id);

  return NextResponse.redirect(fileUrl, {
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
