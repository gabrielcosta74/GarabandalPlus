import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin-auth';
import { supabaseServer } from '../../../../lib/supabase';

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const countMembers = async (filters: (query: any) => any) => {
  if (!supabaseServer) return 0;
  const base = supabaseServer.from('membros').select('id', { count: 'exact', head: true });
  const { count } = await filters(base);
  return count ?? 0;
};

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const status = searchParams.get('status') || 'all';
  const type = searchParams.get('type') || 'all';
  const country = searchParams.get('country') || 'all';

  let query = supabaseServer
    .from('membros')
    .select(
      'id, nome, email, country, numero_socio, estado_quota, proxima_quota, tipo_subscricao, is_membro, data_adesao',
    )
    .order('data_adesao', { ascending: false })
    .limit(500);

  if (q) {
    const numeric = Number(q);
    const orClauses = [`nome.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (Number.isFinite(numeric)) {
      orClauses.push(`numero_socio.eq.${numeric}`);
    }
    query = query.or(orClauses.join(','));
  }

  if (status === 'active') {
    query = query.eq('is_membro', true).in('estado_quota', ['pago', 'paid']);
  } else if (status === 'pending') {
    query = query.or('estado_quota.eq.pendente,is_membro.eq.false');
  } else if (status === 'overdue') {
    query = query.ilike('estado_quota', '%atras%');
  } else if (status === 'nonmember') {
    query = query.eq('is_membro', false);
  } else if (status === 'due_soon') {
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    query = query
      .eq('is_membro', true)
      .gte('proxima_quota', toDateString(today))
      .lte('proxima_quota', toDateString(end));
  }

  if (country !== 'all') {
    query = query.eq('country', country);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: 'Erro ao carregar membros.' }, { status: 500 });
  }

  let members = (data || []) as any[];

  if (type !== 'all') {
    const isFounder = (value?: string | null) => (value || '').toLowerCase().includes('fundador');
    if (type === 'fundador') {
      members = members.filter((member) => isFounder(member.tipo_subscricao));
    }
    if (type === 'regular') {
      members = members.filter((member) => !isFounder(member.tipo_subscricao));
    }
  }

  const summary = {
    total: await countMembers((q) => q),
    active: await countMembers((q) => q.eq('is_membro', true).in('estado_quota', ['pago', 'paid'])),
    pending: await countMembers((q) => q.or('estado_quota.eq.pendente,is_membro.eq.false')),
    overdue: await countMembers((q) => q.ilike('estado_quota', '%atras%')),
    founders: await countMembers((q) => q.ilike('tipo_subscricao', '%fundador%')),
    dueSoon: await countMembers((q) => {
      const today = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      return q
        .eq('is_membro', true)
        .gte('proxima_quota', toDateString(today))
        .lte('proxima_quota', toDateString(end));
    }),
  };

  return NextResponse.json({ members, summary });
}
