export type AuthCallbackRedirectInput = {
  type?: string | null;
  next?: string | null;
  refCode?: string | null;
  locale?: string | null;
};

export type UpdatePasswordAuthPayload =
  | { kind: 'code'; code: string }
  | { kind: 'otp'; tokenHash: string; type: string }
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'none' };

export function normalizeAuthNextPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return null;
  }

  return value;
}

export function buildAuthCallbackLoginUrl(
  next: string | null | undefined,
  locale: string | null | undefined,
) {
  const loginPath = locale === 'en' ? '/en/login' : '/login';
  const safeNext = normalizeAuthNextPath(next);

  if (!safeNext) return loginPath;

  return `${loginPath}?next=${encodeURIComponent(safeNext)}`;
}

const SUPABASE_OTP_TYPES = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
  'sms',
  'phone_change',
  'reauthentication',
]);

export function buildRecoveryRedirectUrl(appUrl: string, locale: 'pt' | 'en' = 'pt') {
  const baseUrl = appUrl.replace(/\/$/, '');
  const url = new URL('/auth-callback', `${baseUrl}/`);
  url.searchParams.set('next', locale === 'en' ? '/en/auth/update-password' : '/auth/update-password');
  url.searchParams.set('type', 'recovery');
  url.searchParams.set('locale', locale);
  return url.toString();
}

export function buildRecoveryFailurePath(locale: string | null | undefined) {
  const path = locale === 'en' ? '/en/auth/update-password' : '/auth/update-password';
  return `${path}?status=invalid-link`;
}

export function hasAuthCallbackPayload(currentUrl: string) {
  const url = new URL(currentUrl);
  const hash = url.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const type = url.searchParams.get('type') || hashParams.get('type');
  const hasSupabaseOtpToken = Boolean(
    (url.searchParams.get('token_hash') || url.searchParams.get('token')) &&
    type &&
    SUPABASE_OTP_TYPES.has(type)
  );
  const hasHashSession = Boolean(hashParams.get('access_token') && hashParams.get('refresh_token'));
  const hasSupabaseErrorCode = Boolean(url.searchParams.get('error_code') || hashParams.get('error_code'));
  const hasAuthError = Boolean(
    (url.searchParams.get('error') || hashParams.get('error')) &&
    (hasSupabaseErrorCode || (type && SUPABASE_OTP_TYPES.has(type)))
  );

  return Boolean(
    url.searchParams.get('code') ||
    hashParams.get('code') ||
    hasSupabaseOtpToken ||
    hasHashSession ||
    hasAuthError
  );
}

export function resolveAuthCallbackRedirect({ type, next, refCode, locale }: AuthCallbackRedirectInput) {
  const isEn = locale === 'en';
  const safeNext = normalizeAuthNextPath(next);

  if (type === 'recovery') {
    return isEn ? '/en/auth/update-password' : '/auth/update-password';
  }

  if (safeNext) {
    return safeNext;
  }

  if (refCode) {
    return isEn
      ? `/en/become-member?ref=${encodeURIComponent(refCode)}&join=1`
      : `/tornar-membro?ref=${encodeURIComponent(refCode)}&join=1`;
  }

  return isEn ? '/en/member' : '/member';
}

export function detectUpdatePasswordAuthPayload(currentUrl: string): UpdatePasswordAuthPayload {
  const url = new URL(currentUrl);
  const hash = url.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);

  const code = url.searchParams.get('code') || hashParams.get('code');
  if (code) {
    return { kind: 'code', code };
  }

  const type = url.searchParams.get('type') || hashParams.get('type');
  const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token');
  if (tokenHash && type) {
    return { kind: 'otp', tokenHash, type };
  }

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken && type === 'recovery') {
    return {
      kind: 'session',
      accessToken,
      refreshToken,
    };
  }

  return { kind: 'none' };
}
