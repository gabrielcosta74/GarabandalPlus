import { NextResponse } from 'next/server';
import { verifyAdmin } from './admin-auth';
import { supabaseServer } from './supabase';

export const requireMarketingAdmin = async (req: Request) => {
  const { authorized, error, user } = await verifyAdmin(req);
  if (!authorized) {
    const status = error === 'Forbidden: Not an Admin' ? 403 : 401;
    return {
      ok: false as const,
      response: NextResponse.json({ error: error || 'Unauthorized' }, { status }),
    };
  }

  if (!supabaseServer) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Database Config Error' }, { status: 500 }),
    };
  }

  return { ok: true as const, supabase: supabaseServer, user };
};

export const jsonError = (error: unknown, fallback = 'Internal Server Error') => {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
};
