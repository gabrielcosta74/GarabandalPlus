import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const q = String(searchParams.get('q') || '').trim();

    let query = auth.supabase
      .from('marketing_message_logs')
      .select('*, contact:marketing_contacts(display_name,normalized_email,language,lead_score,lifecycle_stage), campaign:marketing_campaigns(name), funnel:marketing_funnels(name,slug)')
      .order('created_at', { ascending: false })
      .limit(150);

    if (status && status !== 'all') query = query.eq('status', status);
    if (q) query = query.or(`to_email.ilike.%${q}%,subject.ilike.%${q}%,template_key.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: statsError } = await auth.supabase
      .from('marketing_message_logs')
      .select('status, metadata')
      .gte('created_at', since);
    if (statsError) throw statsError;

    // opened/clicked/bounced vêm do webhook do Resend (metadata gravada por evento).
    const stats = (recent || []).reduce<Record<string, number>>((acc, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      const meta = row.metadata || {};
      if (meta.opened_at) acc.opened = (acc.opened || 0) + 1;
      if (meta.clicked_at) acc.clicked = (acc.clicked || 0) + 1;
      if (meta.bounced_at || meta.complained_at) acc.bounced = (acc.bounced || 0) + 1;
      return acc;
    }, { total: 0 });

    return NextResponse.json({ messages: data || [], stats });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar outbox.');
  }
}
