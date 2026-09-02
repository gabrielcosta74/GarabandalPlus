import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { normalizeEmail } from '../../../../../lib/normalize';
import { checkRateLimit } from '../../../../../lib/rate-limit';
import { sendAuthRecoveryEmail } from '../../../../../lib/email';

export const dynamic = 'force-dynamic';

// The mobile app owns the recovery UX end-to-end: the styled email carries a
// 6-digit code that the user types on a native screen. Email deep links are
// unreliable across mail clients, so the code is the primary path and the
// button simply opens the app's recovery screen with the email pre-filled.
const MOBILE_APP_RESET_SCHEME = 'garabandalmembros://reset-password';
const MOBILE_APP_SCHEME = 'garabandalmembros:';

function pathEndsWithResetPassword(url: URL) {
  // Custom-scheme URLs parse inconsistently: "scheme://reset-password" exposes
  // "reset-password" as the hostname, while "scheme:///reset-password" exposes
  // it as the pathname. Accept both shapes.
  return url.hostname === 'reset-password' || url.pathname.replace(/\/$/, '').endsWith('reset-password');
}

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
    url.pathname.endsWith('/--/reset-password')
  );
}

// Optional: Expo Go development builds pass their own exp:// base so the deep
// link opens the running dev client instead of a standalone install.
function sanitizeAppBase(value: unknown): string | null {
  if (value == null || value === '') return MOBILE_APP_RESET_SCHEME;
  if (typeof value !== 'string') return null;

  const base = value.trim();
  if (!base) return MOBILE_APP_RESET_SCHEME;

  try {
    const parsed = new URL(base);
    if (parsed.protocol === MOBILE_APP_SCHEME && pathEndsWithResetPassword(parsed)) {
      return base;
    }
    if (isAllowedExpoGoRedirect(parsed)) return parsed.toString();
  } catch {
    return null;
  }

  return null;
}

function buildAppResetLink(appBase: string, email: string, locale: 'pt' | 'en') {
  const url = new URL(appBase);
  url.searchParams.set('email', email);
  url.searchParams.set('locale', locale);
  return url.toString();
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

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'mobile-auth-send-recovery-link',
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
    const locale: 'pt' | 'en' = body?.locale === 'en' ? 'en' : 'pt';
    const appBase = sanitizeAppBase(body?.appBase);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Email inválido.' }, { status: 400 });
    }

    if (!appBase) {
      return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 400 });
    }

    // Never reveal whether an account exists. Return a generic success so the
    // app always shows the "check your email" step.
    const exists = await authUserExists(email);
    if (!exists) {
      return NextResponse.json({ success: true });
    }

    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    const rawOtpCode = data?.properties?.email_otp ?? '';
    const otpCode = /^\d{6}$/.test(rawOtpCode) ? rawOtpCode : null;

    if (error || !otpCode) {
      console.error('[API] mobile send-recovery-link generateLink error:', {
        message: error?.message,
        hasValidOtpCode: Boolean(otpCode),
      });
      // Still respond generically to avoid leaking account state.
      return NextResponse.json({ success: true });
    }

    const appResetLink = buildAppResetLink(appBase, email, locale);
    const sent = await sendAuthRecoveryEmail({
      email,
      recoveryLink: appResetLink,
      codeEntryLink: appResetLink,
      otpCode,
      locale,
    });

    if (!sent) {
      console.error('[API] mobile send-recovery-link email provider unavailable');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] mobile send-recovery-link error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar email.' }, { status: 500 });
  }
}
