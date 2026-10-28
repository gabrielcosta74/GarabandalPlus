import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request: Request) {
  const { authorized } = await verifyAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers });
  try {
    const { data, error } = await supabaseServer.from('pilgrimage_checkin_archives')
      .select('id, title, notes, source_pilgrimage_id, submissions:pilgrimage_checkin_submissions(count)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const archives = (data || []).map(archive => ({
      id: archive.id, title: archive.title, notes: archive.notes,
      pilgrimageId: archive.source_pilgrimage_id, count: archive.submissions?.[0]?.count || 0,
    }));
    return NextResponse.json({ archives }, { headers });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar o arquivo de check-in.' }, { status: 500, headers });
  }
}
