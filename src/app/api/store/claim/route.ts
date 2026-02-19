import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { hashAccessToken } from '../../../../lib/store-access';
import { normalizeEmail } from '../../../../lib/normalize';

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

const findAuthUserByEmail = async (email: string) => {
  if (!supabaseServer) return null;
  const target = email.toLowerCase();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users || [];
    const match = users.find((user) => (user.email || '').toLowerCase() === target);
    if (match) return match;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const resolveClaimToken = async (accessToken: string) => {
  const tokenHash = hashAccessToken(accessToken);
  const { data: tokenRow, error: tokenError } = await supabaseServer!
    .from('store_order_access_tokens')
    .select('order_ref, buyer_email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return { tokenHash, tokenRow: null as any, error: NextResponse.json({ message: 'Token inválido.' }, { status: 404 }) };
  }
  if (tokenRow.used_at) {
    return { tokenHash, tokenRow: null as any, error: NextResponse.json({ message: 'Este link já foi utilizado.' }, { status: 400 }) };
  }
  if (isExpired(tokenRow.expires_at)) {
    return { tokenHash, tokenRow: null as any, error: NextResponse.json({ message: 'Este link expirou.' }, { status: 400 }) };
  }
  return { tokenHash, tokenRow, error: null as Response | null };
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

  let emailExists = false;
  try {
    const lookupEmail = normalizeEmail(tokenRow.buyer_email);
    if (lookupEmail) {
      emailExists = !!(await findAuthUserByEmail(lookupEmail));
    }
  } catch (err) {
    emailExists = false;
  }

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

  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body?.token === 'string' ? body.token : null;
  const mode = typeof body?.mode === 'string' ? body.mode : 'claim';
  const password = typeof body?.password === 'string' ? body.password.trim() : '';
  const source = typeof body?.source === 'string' ? body.source : 'claim_link';

  if (!accessToken) {
    return NextResponse.json({ message: 'Token ausente.' }, { status: 400 });
  }

  const resolvedClaim = await resolveClaimToken(accessToken);
  if (resolvedClaim.error) return resolvedClaim.error;
  const { tokenHash, tokenRow } = resolvedClaim;

  if (mode === 'register') {
    if (password.length < 6) {
      return NextResponse.json({ message: 'A password deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const tokenEmail = normalizeEmail(tokenRow.buyer_email);
    if (!tokenEmail) {
      return NextResponse.json({ message: 'Email do pedido inválido.' }, { status: 400 });
    }

    const existingUser = await findAuthUserByEmail(tokenEmail);
    if (existingUser) {
      return NextResponse.json({ ok: true, exists: true });
    }

    const { data: order } = await supabaseServer
      .from('store_orders')
      .select('buyer_name')
      .eq('order_ref', tokenRow.order_ref)
      .maybeSingle();

    const { data: createdUser, error: createUserError } = await supabaseServer.auth.admin.createUser({
      email: tokenEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: order?.buyer_name || null,
        source: 'store_claim',
      },
    });

    if (createUserError) {
      return NextResponse.json({ message: createUserError.message || 'Não foi possível criar a conta.' }, { status: 400 });
    }

    if (createdUser?.user?.id) {
      await supabaseServer
        .from('membros')
        .upsert(
          {
            id: createdUser.user.id,
            email: tokenEmail,
            nome: order?.buyer_name || tokenEmail.split('@')[0],
            is_membro: false,
            tipo_subscricao: 'regulares',
            estado_quota: 'pendente',
            data_adesao: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
    }

    return NextResponse.json({ ok: true, exists: false });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ message: 'Sessão inválida.' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ message: 'Sessão inválida.' }, { status: 401 });
  }

  const email = normalizeEmail(userData.user.email);
  const tokenEmail = normalizeEmail(tokenRow.buyer_email);
  if (!email || !tokenEmail || email !== tokenEmail) {
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
    .ilike('buyer_email', tokenRow.buyer_email);

  await supabaseServer
    .from('store_order_access_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  return NextResponse.json({ ok: true });
}
