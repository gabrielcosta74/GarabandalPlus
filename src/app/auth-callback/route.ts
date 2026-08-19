import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildAuthCallbackLoginUrl,
  buildRecoveryFailurePath,
  resolveAuthCallbackRedirect,
} from '../../lib/auth-redirects';

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export const dynamic = 'force-dynamic';

function redirectWithCookies(destination: URL, cookiesToSet: CookieToSet[]) {
  const response = NextResponse.redirect(destination, 303);

  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options);
  }

  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const refCode = searchParams.get('ref');
  const locale = searchParams.get('locale');
  const next = searchParams.get('next');
  const loginUrl = new URL(
    buildAuthCallbackLoginUrl(next, locale),
    request.nextUrl.origin,
  );
  const recoveryFailureUrl = new URL(
    buildRecoveryFailurePath(locale),
    request.nextUrl.origin,
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    loginUrl.searchParams.set('error', 'auth-config');
    return NextResponse.redirect(loginUrl, 303);
  }

  const providerError = searchParams.get('error');
  if (providerError || !code) {
    if (type === 'recovery') {
      return NextResponse.redirect(recoveryFailureUrl, 303);
    }
    loginUrl.searchParams.set('error', providerError || 'missing-code');
    return NextResponse.redirect(loginUrl, 303);
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values) {
        cookiesToSet.push(...values);
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[AuthCallback] Error exchanging OAuth code:', {
      name: error.name,
      code: 'code' in error ? error.code : undefined,
      message: error.message,
    });
    if (type === 'recovery') {
      return redirectWithCookies(recoveryFailureUrl, cookiesToSet);
    }
    loginUrl.searchParams.set('error', 'code-exchange');
    return redirectWithCookies(loginUrl, cookiesToSet);
  }

  const destination = resolveAuthCallbackRedirect({
    type,
    next,
    refCode,
    locale,
  });

  return redirectWithCookies(
    new URL(destination, request.nextUrl.origin),
    cookiesToSet,
  );
}
