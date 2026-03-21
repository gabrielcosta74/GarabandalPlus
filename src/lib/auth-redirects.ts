export type AuthCallbackRedirectInput = {
  type?: string | null;
  next?: string | null;
  refCode?: string | null;
};

export type UpdatePasswordAuthPayload =
  | { kind: 'code'; code: string }
  | { kind: 'otp'; tokenHash: string; type: string }
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'none' };

export function buildRecoveryRedirectUrl(appUrl: string) {
  const baseUrl = appUrl.replace(/\/$/, '');
  const url = new URL('/auth-callback', `${baseUrl}/`);
  url.searchParams.set('next', '/auth/update-password');
  url.searchParams.set('type', 'recovery');
  return url.toString();
}

export function resolveAuthCallbackRedirect({ type, next, refCode }: AuthCallbackRedirectInput) {
  if (type === 'recovery') {
    return '/auth/update-password';
  }

  if (next && next.startsWith('/')) {
    return next;
  }

  if (refCode) {
    return `/tornar-membro?ref=${encodeURIComponent(refCode)}&join=1`;
  }

  return '/';
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
