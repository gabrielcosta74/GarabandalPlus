import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const [{ data: subscribers, error: subscribersError }, { data: campaigns }, { count: suppressed }] = await Promise.all([
      auth.supabase
        .from('newsletter_subscribers')
        .select('id,normalized_email,display_name,language,group_label,country,subscribed_at,imported_at')
        .order('subscribed_at', { ascending: false, nullsFirst: false }),
      auth.supabase
        .from('marketing_campaigns')
        .select('id,name,segment_slug,subject,template_key,status,metrics,created_at')
        .order('created_at', { ascending: false })
        .limit(12),
      auth.supabase
        .from('marketing_suppression_list')
        .select('id', { count: 'exact', head: true }),
    ]);
    if (subscribersError) throw subscribersError;

    const rows = subscribers || [];
    const byLanguage = rows.reduce<Record<string, number>>((acc, row: any) => {
      const language = row.language === 'en' ? 'en' : row.language === 'es' ? 'es' : 'pt';
      acc[language] = (acc[language] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      stats: {
        total: rows.length,
        pt: byLanguage.pt || 0,
        en: byLanguage.en || 0,
        es: byLanguage.es || 0,
        suppressed: suppressed || 0,
      },
      recentSubscribers: rows.slice(0, 10),
      campaigns: campaigns || [],
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar a newsletter.');
  }
}
