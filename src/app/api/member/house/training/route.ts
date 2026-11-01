import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function member(req: Request) {
  if (!supabaseServer) return { error: 'Serviço indisponível.', status: 500 as const };
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: 'Inicie sessão para continuar.', status: 401 as const };
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data.user) return { error: 'Sessão inválida.', status: 401 as const };
  const id = data.user.id;
  const [access, seniority] = await Promise.all([
    supabaseServer.rpc('member_area_access', { p_user: id }),
    supabaseServer.rpc('house_seniority_ok', { p_user: id }),
  ]);
  if (access.error || seniority.error) return { error: 'Não foi possível validar a elegibilidade.', status: 500 as const };
  return { id, eligible: access.data === true && seniority.data === true };
}

export async function GET(req: Request) {
  const auth = await member(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = supabaseServer!;
  const { data: application, error } = await db.from('house_training_applications')
    .select('id, status, cohort_id, code_id, contact_name, contact_email, contact_phone, availability_notes, completed_at, created_at')
    .eq('membro_id', auth.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: 'Não foi possível carregar a formação.' }, { status: 500 });

  const [cohort, code, activeCode] = await Promise.all([
    application?.cohort_id ? db.from('house_training_cohorts').select('title, starts_at, meeting_url').eq('id', application.cohort_id).maybeSingle() : null,
    application?.code_id ? db.from('house_training_codes').select('code, valid_until, revoked_at').eq('id', application.code_id).eq('membro_id', auth.id).maybeSingle() : null,
    db.from('house_training_codes').select('code, valid_until').eq('membro_id', auth.id)
      .is('revoked_at', null).or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (cohort?.error || code?.error || activeCode.error) return NextResponse.json({ error: 'Não foi possível carregar a formação.' }, { status: 500 });
  return NextResponse.json({ eligible: auth.eligible, activeCode: activeCode.data ?? null, application: application ? {
    ...application, cohort: cohort?.data ? {
      title: cohort.data.title, starts_at: cohort.data.starts_at,
      meeting_url: application.status === 'assigned' ? cohort.data.meeting_url : null,
    } : null,
    code: code?.data?.revoked_at ? null : code?.data?.code ?? null,
    codeValidUntil: code?.data?.valid_until ?? null,
  } : null });
}

export async function POST(req: Request) {
  const auth = await member(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.eligible) return NextResponse.json({ error: 'A formação está disponível para membros elegíveis para usar a Casa.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Formulário inválido.' }, { status: 400 }); }
  const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const name = clean(body.name, 160);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 40);
  const availability = clean(body.availability, 1000);
  if (name.length < 2 || !emailPattern.test(email) || phone.length < 5) {
    return NextResponse.json({ error: 'Confirme o nome, email e telefone.' }, { status: 400 });
  }
  const db = supabaseServer!;
  const [existing, validCode] = await Promise.all([
    db.from('house_training_applications').select('id').eq('membro_id', auth.id)
      .in('status', ['pending', 'assigned', 'completed']).limit(1).maybeSingle(),
    db.from('house_training_codes').select('id').eq('membro_id', auth.id)
      .is('revoked_at', null).or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`).limit(1).maybeSingle(),
  ]);
  if (existing.error || validCode.error) return NextResponse.json({ error: 'Não foi possível validar o pedido.' }, { status: 500 });
  if (existing.data) return NextResponse.json({ error: 'Já tem um pedido de formação em curso.' }, { status: 409 });
  if (validCode.data) return NextResponse.json({ error: 'Já tem um código de formação válido.' }, { status: 409 });
  const { data, error } = await db.from('house_training_applications').insert({
    membro_id: auth.id, contact_name: name, contact_email: email,
    contact_phone: phone, availability_notes: availability || null,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Já tem um pedido de formação em curso.' : 'Não foi possível enviar o pedido.' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
