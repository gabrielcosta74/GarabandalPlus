import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { normalizeEmail } from '../../../../../lib/normalize';
import { checkRateLimit } from '../../../../../lib/rate-limit';
import { sendAuthMagicLinkEmail } from '../../../../../lib/email';
import { getAppUrl } from '../../../../../lib/config';

export const dynamic = 'force-dynamic';

const MOBILE_APP_LOGIN_REDIRECT = 'garabandalmembros://login';

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isAllowedExpoGoRedirect(url: URL) {
  return (
    url.protocol === 'exp:' &&
    (url.hostname === 'localhost' || isPrivateIpv4(url.hostname)) &&
    url.pathname.endsWith('/--/login')
  );
}

async function authUserExists(email: string) {
  if (!supabaseServer) return false;

  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    if (users.some((user) => (user.email || '').toLowerCase() === email)) return true;
    if (users.length < perPage) break;
    page += 1;
  }

  return false;
}

function sanitizeRedirectTo(value: unknown) {
  if (value == null || value === '') return MOBILE_APP_LOGIN_REDIRECT;
  if (typeof value !== 'string') return null;

  const redirectTo = value.trim();
  if (!redirectTo) return MOBILE_APP_LOGIN_REDIRECT;

  if (redirectTo === MOBILE_APP_LOGIN_REDIRECT) return redirectTo;

  try {
    const parsed = new URL(redirectTo);
    if (isAllowedExpoGoRedirect(parsed)) return parsed.toString();
  } catch {
    return null;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'mobile-auth-send-magic-link',
      windowMs: 60_000,
      max: 8,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    if (!supabaseServer) {
      return NextResponse.json({ success: false, message: 'Configuração inválida.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const redirectTo = sanitizeRedirectTo(body?.redirectTo);

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email inválido.' }, { status: 400 });
    }

    if (!redirectTo) {
      return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 400 });
    }

    const exists = await authUserExists(email);
    if (!exists) {
      return NextResponse.json({ success: true });
    }

    const mobileCallbackUrl = new URL('/auth/mobile-callback', getAppUrl());
    mobileCallbackUrl.searchParams.set('return_to', redirectTo);

    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: mobileCallbackUrl.toString() },
    });

    if (error) {
      console.error('[API] mobile send-magic-link generateLink error:', error);
      return NextResponse.json({ success: false, message: 'Falha ao gerar link de acesso.' }, { status: 500 });
    }

    const magicLink = data?.properties?.action_link;
    if (!magicLink) {
      return NextResponse.json({ success: false, message: 'Link não disponível.' }, { status: 500 });
    }

    const sent = await sendAuthMagicLinkEmail({ email, magicLink });
    if (!sent) {
      return NextResponse.json({ success: false, message: 'Serviço de email indisponível.' }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] mobile send-magic-link error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar link.' }, { status: 500 });
  }
}
