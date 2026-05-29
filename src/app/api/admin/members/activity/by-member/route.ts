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
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    // Drill-down: recent activity timeline for a single member.
    if (userId) {
      const { data, error } = await supabaseServer
        .from('member_activity')
        .select('id, path, feature, content_id, locale, session_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return NextResponse.json({ timeline: data || [] });
    }

    // List: one row per member with engagement aggregates.
    const { data, error } = await supabaseServer
      .from('admin_member_engagement')
      .select('user_id, nome, numero_socio, email, estado_quota, is_membro, data_adesao, last_sign_in_at, last_activity_at, events_30d, sessions_30d, top_feature')
      .order('last_activity_at', { ascending: false, nullsFirst: false });
    if (error) throw error;

    return NextResponse.json({ members: data || [] });
  } catch (e: any) {
    console.error('Member activity by-member error:', e);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
