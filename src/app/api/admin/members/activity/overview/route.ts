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
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)));

    const [overviewRes, dailyRes, featuresRes, topRes, dormantRes] = await Promise.all([
      supabaseServer.rpc('admin_activity_overview'),
      supabaseServer.rpc('admin_activity_daily', { p_days: days }),
      supabaseServer.rpc('admin_activity_features', { p_days: days }),
      // Most engaged members in the last 30 days
      supabaseServer
        .from('admin_member_engagement')
        .select('user_id, nome, numero_socio, events_30d, sessions_30d, top_feature, last_activity_at')
        .gt('events_30d', 0)
        .order('events_30d', { ascending: false })
        .limit(8),
      // Active members who have not used the area in 30+ days (or never)
      supabaseServer
        .from('admin_member_engagement')
        .select('user_id, nome, numero_socio, estado_quota, last_sign_in_at, last_activity_at')
        .eq('is_membro', true)
        .or(`last_activity_at.is.null,last_activity_at.lt.${new Date(Date.now() - days * 86400000).toISOString()}`)
        .order('last_activity_at', { ascending: true, nullsFirst: true })
        .limit(12),
    ]);

    return NextResponse.json({
      kpis: overviewRes.data || {},
      daily: dailyRes.data || [],
      features: featuresRes.data || [],
      topMembers: topRes.data || [],
      dormantMembers: dormantRes.data || [],
      meta: { days },
    });
  } catch (e: any) {
    console.error('Member activity overview error:', e);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
