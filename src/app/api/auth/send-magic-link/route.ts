import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { sendAuthMagicLinkEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';

export const dynamic = 'force-dynamic';

async function authUserExists(email: string) {
  if (!supabaseServer) return false;

  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    if (users.some((u) => (u.email || '').toLowerCase() === email)) return true;
    if (users.length < perPage) break;
    page += 1;
  }

  return false;
}

function sanitizeNextPath(next: unknown) {
  if (typeof next !== 'string') return '/peregrinacoes/minhas-inscricoes';
  if (!next.startsWith('/')) return '/peregrinacoes/minhas-inscricoes';
  return next;
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'auth-send-magic-link',
      windowMs: 60_000,
      max: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const host = req.headers.get('host') || '';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const isDev = process.env.NODE_ENV === 'development';
    const isInternalRequest = !!host && (origin.includes(host) || referer.includes(host));

    if (!isDev && !isInternalRequest) {
      return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ success: false, message: 'Configuração inválida.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const nextPath = sanitizeNextPath(body?.next);

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email inválido.' }, { status: 400 });
    }

    const exists = await authUserExists(email);
    if (!exists) {
      return NextResponse.json(
        { success: false, message: 'Esta conta não existe. Crie conta ou confirme o email.' },
        { status: 404 },
      );
    }

    const appUrl = getAppUrl();
    const redirectTo = `${appUrl}/auth-callback?next=${encodeURIComponent(nextPath)}`;

    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error('[API] send-magic-link generateLink error:', error);
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
    console.error('[API] send-magic-link error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar link.' }, { status: 500 });
  }
}
