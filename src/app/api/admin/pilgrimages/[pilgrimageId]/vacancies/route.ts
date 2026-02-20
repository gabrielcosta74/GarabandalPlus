import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pilgrimageId: string }> }
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const { pilgrimageId } = await params;
    const { data, error } = await supabaseServer
      .rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: pilgrimageId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      success: true,
      vacancies: row || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to recalculate vacancies' },
      { status: 500 }
    );
  }
}
