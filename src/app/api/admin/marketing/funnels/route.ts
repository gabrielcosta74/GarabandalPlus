import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';
import { prepareMarketingFunnelEnrollments } from '../../../../../lib/marketing-automation-engine';

export const dynamic = 'force-dynamic';

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await auth.supabase
      .from('marketing_funnels')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const funnelIds = (data || []).map((funnel: any) => funnel.id);
    const { data: enrollments } = funnelIds.length
      ? await auth.supabase.from('marketing_enrollments').select('funnel_id,status').in('funnel_id', funnelIds)
      : { data: [] };

    const counts = (enrollments || []).reduce<Record<string, Record<string, number>>>((acc, row: any) => {
      acc[row.funnel_id] ||= {};
      acc[row.funnel_id][row.status] = (acc[row.funnel_id][row.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      funnels: (data || []).map((funnel: any) => ({ ...funnel, enrollment_counts: counts[funnel.id] || {} })),
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar funis.');
  }
}

export async function POST(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

    const { data, error } = await auth.supabase
      .from('marketing_funnels')
      .insert({
        name,
        slug: slugify(String(body?.slug || name)),
        description: body?.description || null,
        trigger_type: body?.trigger_type || 'manual',
        segment_slug: body?.segment_slug || null,
        steps: Array.isArray(body?.steps) ? body.steps : [],
        status: body?.status || 'draft',
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ funnel: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível criar funil.');
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.trigger_type !== undefined) updates.trigger_type = body.trigger_type;
    if (body.segment_slug !== undefined) updates.segment_slug = body.segment_slug;
    if (body.steps !== undefined) updates.steps = Array.isArray(body.steps) ? body.steps : [];
    if (body.status !== undefined) updates.status = body.status;

    const { data, error } = await auth.supabase
      .from('marketing_funnels')
      .update(updates)
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) throw error;

    let preparation = null;
    if (body.status === 'active') {
      preparation = await prepareMarketingFunnelEnrollments(auth.supabase, data, { limit: 250, reactivatePaused: true });
    }

    return NextResponse.json({ funnel: data, preparation });
  } catch (error) {
    return jsonError(error, 'Não foi possível atualizar funil.');
  }
}
