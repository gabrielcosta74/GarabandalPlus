import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { sendAuthRecoveryEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';
import { buildRecoveryRedirectUrl } from '../../../../lib/auth-redirects';

export const dynamic = 'force-dynamic';

const MIN_RESPONSE_TIME_MS = 450;

function requestSourceMatchesHost(value: string, host: string) {
  if (!value || !host) return false;
  try {
    return new URL(value).host === host;
  } catch {
    return false;
  }
}

async function genericSuccess(startedAt: number) {
  const remaining = MIN_RESPONSE_TIME_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'auth-send-recovery-link',
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
    const isInternalRequest = requestSourceMatchesHost(origin, host)
      || requestSourceMatchesHost(referer, host);

    if (!isDev && !isInternalRequest) {
      return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ success: false, message: 'Configuração inválida.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const locale: 'pt' | 'en' = body?.locale === 'en' ? 'en' : 'pt';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Email inválido.' }, { status: 400 });
    }

    const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 24);
    const emailRateLimit = checkRateLimit(req, {
      keyPrefix: `auth-send-recovery-link-email-${emailHash}`,
      windowMs: 60_000,
      max: 1,
    });

    if (!emailRateLimit.allowed) {
      return genericSuccess(startedAt);
    }

    const appUrl = getAppUrl();
    const redirectTo = buildRecoveryRedirectUrl(appUrl, locale);
    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    const recoveryLink = data?.properties?.action_link;
    if (error || !recoveryLink) {
      console.error('[API] send-recovery-link generateLink error:', {
        message: error?.message,
        hasRecoveryLink: Boolean(recoveryLink),
      });
      return genericSuccess(startedAt);
    }

    const codeEntryPath = locale === 'en'
      ? '/en/auth/update-password?mode=code'
      : '/auth/update-password?mode=code';
    const codeEntryLink = new URL(codeEntryPath, `${appUrl.replace(/\/$/, '')}/`).toString();
    const otpCode = data.properties?.email_otp ?? null;
    const sent = await sendAuthRecoveryEmail({
      email,
      recoveryLink,
      codeEntryLink,
      otpCode,
      locale,
    });

    if (!sent) {
      console.error('[API] send-recovery-link email provider unavailable');
    }

    return genericSuccess(startedAt);
  } catch (error) {
    console.error('[API] send-recovery-link error:', error);
    return genericSuccess(startedAt);
  }
}
