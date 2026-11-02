import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';
import { aggregateMarketingPerformance } from '../../../../../lib/marketing-performance';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

// O PostgREST corta cada pedido em 1000 linhas: lê por páginas até acabar.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const requested = Number(searchParams.get('days'));
    const days = [7, 30, 90, 365].includes(requested) ? requested : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const db = auth.supabase;

    const logs = await fetchAll<any>((from, to) =>
      db
        .from('marketing_message_logs')
        .select('template_key,status,created_at,metadata')
        .eq('status', 'sent')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .range(from, to),
    );

    // Visitas vindas de email (utm_source=email, utm_campaign = template_key).
    const sessions = await fetchAll<any>((from, to) =>
      db
        .from('site_sessions')
        .select('utm_campaign,visitor_id')
        .eq('utm_source', 'email')
        .gte('started_at', since)
        .order('started_at', { ascending: true })
        .range(from, to),
    );

    const bookedVisitorIds = new Set<string>();
    const visitorIds = Array.from(new Set(sessions.map((s: any) => s.visitor_id).filter(Boolean)));
    for (let i = 0; i < visitorIds.length; i += 100) {
      const { data, error } = await db
        .from('site_visitors')
        .select('id')
        .in('id', visitorIds.slice(i, i + 100))
        .not('booking_id', 'is', null);
      if (error) throw error;
      for (const row of data || []) bookedVisitorIds.add(row.id);
    }

    const { count: unsubscribes, error: unsubError } = await db
      .from('marketing_suppression_list')
      .select('id', { count: 'exact', head: true })
      .in('reason', ['unsubscribe', 'newsletter_unsubscribed'])
      .gte('created_at', since);
    if (unsubError) throw unsubError;

    const { templates, health } = aggregateMarketingPerformance(logs, sessions, bookedVisitorIds);
    const trackedClicks = templates.some((t) => t.clicked > 0 || t.opened > 0);

    return NextResponse.json({
      days,
      templates,
      health: { ...health, unsubscribes: unsubscribes || 0 },
      trackingActive: trackedClicks,
      attributedSessions: sessions.length,
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar o desempenho.');
  }
}
