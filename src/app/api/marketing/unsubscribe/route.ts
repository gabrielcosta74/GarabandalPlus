import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { decodeUnsubscribeEmail, verifyUnsubscribeToken } from '../../../../lib/unsubscribe-token';
import { applyMarketingUnsubscribe } from '../../../../lib/marketing-unsubscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = async (req: Request) => {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const e = searchParams.get('e') || '';
  const t = searchParams.get('t') || '';

  const email = decodeUnsubscribeEmail(e);
  if (!email || !verifyUnsubscribeToken(email, t)) {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 });
  }

  const result = await applyMarketingUnsubscribe(supabaseServer, email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

// RFC 8058 one-click unsubscribe (List-Unsubscribe-Post).
export const POST = handle;
export const GET = handle;
