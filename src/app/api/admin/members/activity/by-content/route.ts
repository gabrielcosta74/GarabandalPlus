import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
  }

  const { authorized, error: authError } = await verifyAdmin(req);
  if (!authorized) {
    const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
  }

  try {
    const { data, error } = await supabaseServer.rpc('admin_content_engagement');
    if (error) throw error;
    return NextResponse.json({ contents: data || [] });
  } catch (e: any) {
    console.error('Member activity by-content error:', e);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
