import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/config';
import { decodeCampaignLoginEmail, verifyCampaignLoginToken } from '../../../../lib/campaign-login-token';

export const dynamic = 'force-dynamic';

// GET /api/auth/campaign-login?e=<base64url email>&t=<hmac>&next=/member
// Link estável de campanha: valida o token, gera um magic link Supabase na hora
// e redireciona o browser para ele (auto-login → /auth-callback → next).
// Se algo falhar, cai no /login para o membro poder entrar à mesma.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = getAppUrl();

  const sanitizeNext = (n: string | null) => {
    if (!n || !n.startsWith('/')) return '/member';
    return n;
  };
  const next = sanitizeNext(url.searchParams.get('next'));
  const loginFallback = `${appUrl}/login?next=${encodeURIComponent(next)}`;

  try {
    const e = url.searchParams.get('e') || '';
    const t = url.searchParams.get('t') || '';

    const email = decodeCampaignLoginEmail(e);
    if (!email || !verifyCampaignLoginToken(email, t)) {
      return NextResponse.redirect(loginFallback);
    }

    if (!supabaseServer) {
      return NextResponse.redirect(loginFallback);
    }

    const redirectTo = `${appUrl}/auth-callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    const actionLink = data?.properties?.action_link;
    if (error || !actionLink) {
      // Conta pode não existir (ainda) — manda para o login com o email pré-preenchido.
      return NextResponse.redirect(`${loginFallback}&email=${encodeURIComponent(email)}`);
    }

    return NextResponse.redirect(actionLink);
  } catch (err) {
    console.error('[campaign-login] error', err);
    return NextResponse.redirect(loginFallback);
  }
}
