import { NextResponse } from 'next/server';
import { requireMarketingAdmin, jsonError } from '../../../../../lib/marketing-api';
import { loadMarian2027Audience } from '../../../../../lib/marian-2027-campaign';
import { getMarian2027Schedule, scheduleMarian2027Campaign } from '../../../../../lib/marian-2027-scheduler';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const language = new URL(req.url).searchParams.get('language') === 'en' ? 'en' : 'pt';
    const [{ audience, sendable, stats }, schedule] = await Promise.all([
      loadMarian2027Audience(auth.supabase, language),
      getMarian2027Schedule(auth.supabase),
    ]);
    return NextResponse.json({
      stats,
      sendable,
      schedule,
      sample: audience.slice(0, 5).map((contact) => ({ name: contact.display_name, email: contact.normalized_email })),
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível consultar a campanha.');
  }
}

export async function POST(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === 'schedule') {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ error: 'A programação real só está disponível em produção.' }, { status: 409 });
      }
      const result = await scheduleMarian2027Campaign(auth.supabase, body.startAt);
      return NextResponse.json({ success: true, ...result });
    }
    if (body?.mode === 'pause' || body?.mode === 'resume') {
      const schedule = await getMarian2027Schedule(auth.supabase);
      if (!schedule.length) return NextResponse.json({ error: 'Esta campanha ainda não foi programada.' }, { status: 404 });
      const currentStates = body.mode === 'pause' ? ['scheduled', 'active'] : ['paused'];
      const nextState = body.mode === 'pause' ? 'paused' : 'scheduled';
      const ids = schedule.filter((row) => currentStates.includes(row.status)).map((row) => row.id);
      if (ids.length) {
        const { error } = await auth.supabase.from('marketing_campaigns')
          .update({ status: nextState, updated_at: new Date().toISOString() }).in('id', ids);
        if (error) throw error;
      }
      return NextResponse.json({ success: true, schedule: await getMarian2027Schedule(auth.supabase) });
    }
    return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 });
  } catch (error) {
    return jsonError(error, 'Não foi possível alterar a programação.');
  }
}
