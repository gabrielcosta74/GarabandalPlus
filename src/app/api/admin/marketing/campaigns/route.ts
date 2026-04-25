import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await auth.supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ campaigns: data || [] });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar campanhas.');
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
      .from('marketing_campaigns')
      .insert({
        name,
        segment_slug: body?.segment_slug || null,
        subject: body?.subject || null,
        template_key: body?.template_key || 'brochure_followup_1',
        body: body?.body || null,
        status: body?.status || 'draft',
        scheduled_at: body?.scheduled_at || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível criar campanha.');
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

    const { data, error } = await auth.supabase
      .from('marketing_campaigns')
      .update({
        name: body.name,
        segment_slug: body.segment_slug,
        subject: body.subject,
        template_key: body.template_key || 'brochure_followup_1',
        body: body.body,
        status: body.status,
        scheduled_at: body.scheduled_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível atualizar campanha.');
  }
}
