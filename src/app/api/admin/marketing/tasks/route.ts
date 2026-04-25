import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'open';
    const { data, error } = await auth.supabase
      .from('marketing_tasks')
      .select('*, contact:marketing_contacts(display_name,normalized_email,lead_score,lifecycle_stage)')
      .eq('status', status)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ tasks: data || [] });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar tarefas.');
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

    const { data, error } = await auth.supabase
      .from('marketing_tasks')
      .update({
        status: body.status,
        priority: body.priority,
        description: body.description,
        due_at: body.due_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível atualizar tarefa.');
  }
}
