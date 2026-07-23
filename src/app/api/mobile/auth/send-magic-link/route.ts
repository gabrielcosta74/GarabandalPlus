import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { normalizeEmail } from '../../../../../lib/normalize';
import { checkRateLimit } from '../../../../../lib/rate-limit';
import { sendAuthMagicLinkEmail } from '../../../../../lib/email';

export const dynamic = 'force-dynamic';

const MOBILE_APP_REDIRECT = 'garabandalmembros://';
const EXPO_GO_DEV_PREFIX = 'exp://';
const LOCAL_DEV_PREFIXES = ['http://localhost:', 'http://127.0.0.1:'];

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
  if (value == null || value === '') return MOBILE_APP_REDIRECT;
  if (typeof value !== 'string') return null;

  const redirectTo = value.trim();
  if (!redirectTo) return MOBILE_APP_REDIRECT;

  if (redirectTo.startsWith(MOBILE_APP_REDIRECT)) return redirectTo;

  if (process.env.NODE_ENV !== 'production') {
    if (redirectTo.startsWith(EXPO_GO_DEV_PREFIX)) return redirectTo;
    if (LOCAL_DEV_PREFIXES.some((prefix) => redirectTo.startsWith(prefix))) return redirectTo;
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

    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
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
