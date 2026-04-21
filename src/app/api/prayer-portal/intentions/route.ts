import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyPortalAccess } from '../../../../lib/prayer-portal-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyPortalAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Erro de configuração' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const all = searchParams.get('all') === 'true';
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let startDate: string;
  let endDate: string;

  if (all) {
    startDate = new Date(2000, 0, 1).toISOString();
    endDate = new Date(2100, 0, 1).toISOString();
  } else if (start && end) {
    startDate = new Date(start).toISOString();
    endDate = new Date(end + 'T23:59:59.999Z').toISOString();
  } else if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split('-').map(Number);
    startDate = new Date(year, mon - 1, 1).toISOString();
    endDate = new Date(year, mon, 0, 23, 59, 59, 999).toISOString();
  } else {
    return NextResponse.json({ error: 'Filtro de datas inválido' }, { status: 400 });
  }

  // Try RPC first, fallback to direct query
  const { data: rpcData, error: rpcError } = await supabaseServer
    .rpc('get_monthly_intentions', { start_date: startDate, end_date: endDate });

  if (!rpcError && rpcData) {
    return NextResponse.json({ intentions: rpcData });
  }

  const { data, error } = await supabaseServer
    .from('prayer_intentions')
    .select('id, intention_text, candle_type, created_at, status, amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar intenções' }, { status: 500 });
  }

  const mapped = (data ?? []).map(i => ({ ...i, user_name: 'Anónimo', user_email: '' }));
  return NextResponse.json({ intentions: mapped });
}

export async function PATCH(req: Request) {
  const auth = await verifyPortalAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Erro de configuração' }, { status: 500 });
  }

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Lista de ids inválida' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('prayer_intentions')
    .update({ status: 'presented' })
    .in('id', ids);

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar intenções' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
