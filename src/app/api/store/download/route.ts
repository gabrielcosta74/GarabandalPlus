import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { hashAccessToken } from '../../../../lib/store-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isExpired = (expiresAt?: string | null) => {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
};

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
    .select('order_ref, product_id, buyer_email, expires_at, download_count')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ message: 'Token inválido.' }, { status: 404 });
  }

  if (isExpired(tokenRow.expires_at)) {
    return NextResponse.json({ message: 'Este link expirou.' }, { status: 400 });
  }

  const { data: accessRow } = await supabaseServer
    .from('store_digital_access')
    .select('file_url, download_count')
    .eq('order_ref', tokenRow.order_ref)
    .eq('product_id', tokenRow.product_id)
    .maybeSingle();

  const { data: productRow } = await supabaseServer
    .from('store_products')
    .select('digital_url')
    .eq('product_id', tokenRow.product_id)
    .maybeSingle();

  // Product digital_url is source of truth. Keep accessRow.file_url only as legacy fallback.
  let fileUrl = productRow?.digital_url || accessRow?.file_url || null;

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
      download_count: (accessRow?.download_count ?? 0) + 1,
    })
    .eq('order_ref', tokenRow.order_ref)
    .eq('product_id', tokenRow.product_id);

  return NextResponse.redirect(fileUrl);
}
