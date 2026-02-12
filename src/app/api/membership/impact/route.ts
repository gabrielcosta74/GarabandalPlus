import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { isActiveMember } from '../../../../lib/store-discounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const { data: members } = await supabaseServer
    .from('membros')
    .select('is_membro, estado_quota, tipo_subscricao, proxima_quota');

  const count = (members || []).filter(isActiveMember).length;

  const { data: metaRow } = await supabaseServer
    .from('donations_meta')
    .select('goal_eur, raised_eur, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    members: count ?? 0,
    goal: Number(metaRow?.goal_eur ?? 2500),
    raised: Number(metaRow?.raised_eur ?? 0),
  });
}
