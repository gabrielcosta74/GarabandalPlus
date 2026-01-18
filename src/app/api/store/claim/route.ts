import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { hashAccessToken } from '../../../../lib/store-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getBearerToken = (request: Request) => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
};

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
    .from('store_order_access_tokens')
    .select('order_ref, buyer_email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ message: 'Token inválido.' }, { status: 404 });
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ message: 'Este link já foi utilizado.' }, { status: 400 });
  }

  if (isExpired(tokenRow.expires_at)) {
    return NextResponse.json({ message: 'Este link expirou.' }, { status: 400 });
  }

  const { data: order } = await supabaseServer
    .from('store_orders')
    .select(
      'order_ref, buyer_name, buyer_email, buyer_nif, buyer_user_id, total_amount, currency, has_physical, shipping_address1, shipping_address2, shipping_city, shipping_postal_code, shipping_country',
    )
    .eq('order_ref', tokenRow.order_ref)
    .maybeSingle();

  const { data: digitalAccess } = await supabaseServer
    .from('store_digital_access')
    .select('id')
    .eq('order_ref', tokenRow.order_ref)
    .limit(1);

  const { data: memberRow } = await supabaseServer
    .from('membros')
    .select('id')
    .eq('email', tokenRow.buyer_email)
    .maybeSingle();
  const emailExists = !!memberRow?.id;

  return NextResponse.json({
    orderRef: order?.order_ref || tokenRow.order_ref,
    buyerEmail: tokenRow.buyer_email,
    buyerName: order?.buyer_name || null,
    buyerNif: order?.buyer_nif || null,
    totalAmount: order?.total_amount || null,
    currency: order?.currency || 'EUR',
    hasPhysical: order?.has_physical || false,
    hasDigital: (digitalAccess || []).length > 0,
    shipping: order
      ? {
          address1: order.shipping_address1,
          address2: order.shipping_address2,
          city: order.shipping_city,
          postalCode: order.shipping_postal_code,
          country: order.shipping_country,
        }
      : null,
    emailExists,
    expiresAt: tokenRow.expires_at,
    isClaimed: !!order?.buyer_user_id,
  });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body?.token === 'string' ? body.token : null;
  const source = typeof body?.source === 'string' ? body.source : 'claim_link';

  if (!accessToken) {
    return NextResponse.json({ message: 'Token ausente.' }, { status: 400 });
  }

  const tokenHash = hashAccessToken(accessToken);
  const { data: tokenRow, error: tokenError } = await supabaseServer
    .from('store_order_access_tokens')
    .select('order_ref, buyer_email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ message: 'Token inválido.' }, { status: 404 });
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ message: 'Este link já foi utilizado.' }, { status: 400 });
  }

  if (isExpired(tokenRow.expires_at)) {
    return NextResponse.json({ message: 'Este link expirou.' }, { status: 400 });
  }

  const email = userData.user.email || '';
  if (!email || email.toLowerCase() !== tokenRow.buyer_email.toLowerCase()) {
    return NextResponse.json({ message: 'O email não corresponde ao pedido.' }, { status: 403 });
  }

  await supabaseServer
    .from('store_orders')
    .update({
      buyer_user_id: userData.user.id,
      claimed_at: new Date().toISOString(),
      claim_source: source,
    })
    .eq('order_ref', tokenRow.order_ref);

  await supabaseServer
    .from('store_digital_access')
    .update({ user_id: userData.user.id })
    .is('user_id', null)
    .eq('order_ref', tokenRow.order_ref)
    .eq('buyer_email', tokenRow.buyer_email);

  await supabaseServer
    .from('store_order_access_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  return NextResponse.json({ ok: true });
}
