import { NextResponse } from 'next/server';
import { prepareMarketingFunnelEnrollments } from '../../../../../../lib/marketing-automation-engine';
import { jsonError, requireMarketingAdmin } from '../../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const funnelId = body?.funnel_id || null;

    let query = auth.supabase.from('marketing_funnels').select('*').eq('status', 'active');
    if (funnelId) query = query.eq('id', funnelId);

    const { data: funnels, error } = await query;
    if (error) throw error;

    const results = [];
    for (const funnel of funnels || []) {
      results.push({
        funnel_id: funnel.id,
        funnel_name: funnel.name,
        ...(await prepareMarketingFunnelEnrollments(auth.supabase, funnel, { limit: 250, reactivatePaused: true })),
      });
    }

    const totals = results.reduce(
      (acc, item) => ({
        sourceContacts: Math.max(acc.sourceContacts, item.sourceContacts || 0),
        eligible: acc.eligible + (item.eligible || 0),
        enrolled: acc.enrolled + (item.enrolled || 0),
        skippedExisting: acc.skippedExisting + (item.skippedExisting || 0),
      }),
      { sourceContacts: 0, eligible: 0, enrolled: 0, skippedExisting: 0 },
    );

    return NextResponse.json({ success: true, activeFunnels: results.length, totals, results });
  } catch (error) {
    return jsonError(error, 'Não foi possível preparar automações.');
  }
}
