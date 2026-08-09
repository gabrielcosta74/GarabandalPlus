import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { type EmailOtpType } from '@supabase/supabase-js';
import { resolveAuthCallbackRedirect } from '../../../lib/auth-redirects';
import { getAppUrl } from '../../../lib/config';

function normalizeNextPath(rawNext: string | null, origin: string) {
  if (!rawNext) return null;
  if (rawNext.startsWith('/')) return rawNext;

  try {
    const parsed = new URL(rawNext);
    if (parsed.origin === origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = getAppUrl();
  const requestLocale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : null;
  const loginPath = requestLocale === 'en' ? '/en/login' : '/login';

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL(`${loginPath}?error=auth-config`, `${appUrl}/`));
  }

  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
  const type = searchParams.get('type') as EmailOtpType | null;
  const refCode = searchParams.get('ref');
  const next = normalizeNextPath(searchParams.get('next'), appUrl);
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      const destination = resolveAuthCallbackRedirect({
        type,
        next,
        refCode,
        locale: requestLocale,
      });
      return NextResponse.redirect(new URL(destination, `${appUrl}/`));
    }

    console.error('[AuthConfirm] verifyOtp error:', error);
  }

  return NextResponse.redirect(new URL(`${loginPath}?error=invalid-link`, `${appUrl}/`));
}
