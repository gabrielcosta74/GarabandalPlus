import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAudit } from '../../../../../lib/admin-audit';
import { newHouseCode } from '../../../../../lib/house-admin';

export const dynamic = 'force-dynamic';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validUrl = (value: string) => {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; }
  catch { return false; }
};

export async function GET(req: Request) {
  const { authorized, error: authError } = await verifyAdmin(req);
  if (!authorized) return NextResponse.json({ error: authError || 'Não autorizado.' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 500 });
  const [cohorts, applications] = await Promise.all([
    supabaseServer.from('house_training_cohorts').select('*').order('starts_at', { ascending: false }),
    supabaseServer.from('house_training_applications').select('id, membro_id, cohort_id, status, contact_name, contact_email, contact_phone, availability_notes, admin_notes, completed_at, created_at, code_id, membros:membro_id ( numero_socio )').order('created_at', { ascending: false }),
  ]);
  if (cohorts.error || applications.error) return NextResponse.json({ error: 'Não foi possível carregar as turmas.' }, { status: 500 });
  return NextResponse.json({ cohorts: cohorts.data ?? [], applications: applications.data ?? [] });
}

export async function PATCH(req: Request) {
  const { authorized, user, error: authError } = await verifyAdmin(req);
  if (!authorized) return NextResponse.json({ error: authError || 'Não autorizado.' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 500 });
  const db = supabaseServer;
  const adminEmail = user?.email ?? null;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const action = body.action;
  const id = clean(body.id, 50);

  if (action === 'create_cohort' || action === 'update_cohort') {
    const title = clean(body.title, 120);
    const startsAt = clean(body.startsAt, 40);
    const meetingUrl = clean(body.meetingUrl, 500);
    const notes = clean(body.notes, 1000);
    const capacity = Number(body.capacity);
    if (title.length < 3 || !startsAt || Number.isNaN(Date.parse(startsAt)) || !validUrl(meetingUrl) || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
      return NextResponse.json({ error: 'Confirme o nome, data, capacidade e ligação HTTPS da turma.' }, { status: 400 });
    }
    const record = { title, starts_at: startsAt, meeting_url: meetingUrl || null, notes: notes || null, capacity, updated_at: new Date().toISOString() };
    if (action === 'update_cohort') {
      const { count, error } = await db.from('house_training_applications').select('id', { count: 'exact', head: true })
        .eq('cohort_id', id).in('status', ['assigned', 'completed', 'code_issued']);
      if (error || count === null) return NextResponse.json({ error: 'Não foi possível confirmar as vagas.' }, { status: 500 });
      if (capacity < count) return NextResponse.json({ error: 'A capacidade não pode ser inferior ao número de membros atribuídos.' }, { status: 409 });
    }
    const result = action === 'create_cohort'
      ? await db.from('house_training_cohorts').insert(record).select('id').single()
      : await db.from('house_training_cohorts').update(record).eq('id', id).select('id').maybeSingle();
    if (result.error || !result.data) return NextResponse.json({ error: 'Não foi possível guardar a turma.' }, { status: 500 });
    await logAdminAudit({ adminEmail, action: `house_training_${action}`, details: { cohortId: result.data.id } });
    return NextResponse.json({ ok: true, id: result.data.id });
  }

  if (action === 'assign') {
    const cohortId = clean(body.cohortId, 50);
    const [cohort, application] = await Promise.all([
      db.from('house_training_cohorts').select('id, capacity').eq('id', cohortId).maybeSingle(),
      db.from('house_training_applications').select('id, membro_id, status, cohort_id').eq('id', id).maybeSingle(),
    ]);
    if (cohort.error || application.error || !cohort.data || !application.data || !['pending', 'assigned'].includes(application.data.status)) {
      return NextResponse.json({ error: 'Turma ou candidatura indisponível.' }, { status: 409 });
    }
    if (application.data.cohort_id !== cohortId) {
      const { count, error } = await db.from('house_training_applications').select('id', { count: 'exact', head: true })
        .eq('cohort_id', cohortId).in('status', ['assigned', 'completed', 'code_issued']);
      if (error || count === null) return NextResponse.json({ error: 'Não foi possível confirmar as vagas.' }, { status: 500 });
      if (count >= cohort.data.capacity) return NextResponse.json({ error: 'A turma já está completa.' }, { status: 409 });
    }
    const { data, error } = await db.from('house_training_applications').update({ cohort_id: cohortId, status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', id).in('status', ['pending', 'assigned']).select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Não foi possível atribuir a turma.' }, { status: 409 });
    await logAdminAudit({ adminEmail, memberId: application.data.membro_id, action: 'house_training_assigned', details: { applicationId: id, cohortId } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'complete' || action === 'decline') {
    const from = action === 'complete' ? ['assigned'] : ['pending', 'assigned'];
    const status = action === 'complete' ? 'completed' : 'declined';
    const { data, error } = await db.from('house_training_applications')
      .update({ status, completed_at: action === 'complete' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', id).in('status', from).select('membro_id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Não foi possível atualizar a candidatura.' }, { status: 409 });
    await logAdminAudit({ adminEmail, memberId: data.membro_id, action: `house_training_${status}`, details: { applicationId: id } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'issue_code') {
    const { data: application, error: loadError } = await db.from('house_training_applications')
      .select('id, membro_id, status, cohort_id').eq('id', id).maybeSingle();
    if (loadError || !application || application.status !== 'completed') {
      return NextResponse.json({ error: 'Marque a formação como concluída antes de emitir o código.' }, { status: 409 });
    }
    const { data: cohort } = await db.from('house_training_cohorts').select('title').eq('id', application.cohort_id).maybeSingle();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = newHouseCode();
      const inserted = await db.from('house_training_codes').insert({
        code: code.display, code_hash: code.hash, code_hint: code.hint,
        membro_id: application.membro_id, waive_seniority: false,
        note: cohort?.title ? `Formação online: ${cohort.title}` : 'Formação online', issued_by: adminEmail,
      }).select('id').single();
      if (inserted.error?.code === '23505') continue;
      if (inserted.error || !inserted.data) return NextResponse.json({ error: 'Não foi possível emitir o código.' }, { status: 500 });
      const updated = await db.from('house_training_applications')
        .update({ status: 'code_issued', code_id: inserted.data.id, updated_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'completed').select('id').maybeSingle();
      if (updated.error || !updated.data) {
        await db.from('house_training_codes').delete().eq('id', inserted.data.id);
        return NextResponse.json({ error: 'A candidatura mudou. Tente novamente.' }, { status: 409 });
      }
      await logAdminAudit({ adminEmail, memberId: application.membro_id, action: 'house_training_code_issued', details: { applicationId: id, codeHint: code.hint } });
      return NextResponse.json({ ok: true, code: code.display });
    }
    return NextResponse.json({ error: 'Não foi possível gerar um código único.' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
}
