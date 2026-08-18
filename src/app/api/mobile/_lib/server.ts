import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';

export const MOBILE_API_VERSION = 1;

export const publicCacheHeaders = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export const privateCacheHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
};

type MobileErrorCode =
  | 'conflict'
  | 'forbidden'
  | 'invalid_request'
  | 'not_found'
  | 'not_configured'
  | 'rate_limited'
  | 'unauthorized'
  | 'upstream_error';

export function mobileError(
  status: number,
  code: MobileErrorCode,
  message: string,
  headers: HeadersInit = privateCacheHeaders,
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
      meta: { apiVersion: MOBILE_API_VERSION },
    },
    { status, headers },
  );
}

export function mobileSuccess<T>(
  data: T,
  options: { status?: number; headers?: HeadersInit; meta?: Record<string, unknown> } = {},
) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: { apiVersion: MOBILE_API_VERSION, ...options.meta },
    },
    { status: options.status ?? 200, headers: options.headers },
  );
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

export type MobileIdentity = {
  user: User;
  userId: string;
  email: string | null;
};

export async function authenticateMobileUser(
  request: Request,
): Promise<{ identity: MobileIdentity; error?: never } | { identity?: never; error: NextResponse }> {
  if (!supabaseServer) {
    return {
      error: mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.'),
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      error: mobileError(401, 'unauthorized', 'Sessão em falta ou inválida.'),
    };
  }

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data.user) {
    return {
      error: mobileError(401, 'unauthorized', 'Sessão em falta ou inválida.'),
    };
  }

  return {
    identity: {
      user: data.user,
      userId: data.user.id,
      email: normalizeEmail(data.user.email) || null,
    },
  };
}

// Backwards-compatible name for the first mobile endpoints. Authentication here
// identifies a Supabase account; membership is enforced by each feature.
export const authenticateMobileMember = authenticateMobileUser;

export async function authenticateOptionalMobileUser(
  request: Request,
): Promise<
  | { identity: MobileIdentity | null; error?: never }
  | { identity?: never; error: NextResponse }
> {
  if (!getBearerToken(request)) return { identity: null };
  return authenticateMobileUser(request);
}

export function getMobileLocale(request: Request): 'pt' | 'en' {
  const locale = new URL(request.url).searchParams.get('locale')?.toLowerCase();
  return locale === 'en' ? 'en' : 'pt';
}

export function getPublicSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://apostoladodegarabandal.com';

  return configured.replace(/\/$/, '');
}

export function isSafeSlug(slug: string) {
  return slug.length > 0 && slug.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug);
}

export function isSafeUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
