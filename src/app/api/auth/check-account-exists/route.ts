import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';

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

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'auth-check-account-exists',
      windowMs: 60_000,
      max: 20,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { exists: false },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const host = req.headers.get('host') || '';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const isDev = process.env.NODE_ENV === 'development';
    const isInternalRequest = !!host && (origin.includes(host) || referer.includes(host));

    // Avoid exposing a public account-enumeration endpoint.
    if (!isDev && !isInternalRequest) {
      return NextResponse.json({ exists: false });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ exists: false });

    const exists = await authUserExists(email);
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('[API] check-account-exists error:', error);
    return NextResponse.json({ exists: false });
  }
}
