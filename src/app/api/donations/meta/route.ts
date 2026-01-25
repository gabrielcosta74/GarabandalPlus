import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const { data: metaRow } = await supabaseServer
    .from('donations_meta')
    .select('goal_eur, raised_eur, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const goal = Number(metaRow?.goal_eur ?? 2500);
  const raised = Number(metaRow?.raised_eur ?? 0);

  return NextResponse.json(
    { goal, raised },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
