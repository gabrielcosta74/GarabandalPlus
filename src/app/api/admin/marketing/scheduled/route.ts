import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';
import { evaluateMarketingEnrollment } from '../../../../../lib/marketing-automation-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get('bucket') || 'all';

    const { data, error } = await auth.supabase
      .from('marketing_enrollments')
      .select('*, contact:marketing_contacts(id,display_name,normalized_email,language,lead_score,lifecycle_stage,recommendation,consent_state,source_summary), funnel:marketing_funnels(name,slug,steps,status)')
      .in('status', ['active', 'paused', 'failed'])
      .order('next_run_at', { ascending: true })
      .limit(250);

    if (error) throw error;

    const contactIds = Array.from(new Set((data || []).map((row: any) => row.contact_id).filter(Boolean)));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs, error: logsError } = contactIds.length
      ? await auth.supabase
          .from('marketing_message_logs')
          .select('contact_id,created_at,status')
          .in('contact_id', contactIds)
          .eq('status', 'sent')
          .gte('created_at', weekAgo)
      : { data: [], error: null };
    if (logsError) throw logsError;

    const counts = (recentLogs || []).reduce<Record<string, { day: number; week: number }>>((acc, log: any) => {
      if (!log.contact_id) return acc;
      acc[log.contact_id] ||= { day: 0, week: 0 };
      acc[log.contact_id].week += 1;
      if (log.created_at >= dayAgo) acc[log.contact_id].day += 1;
      return acc;
    }, {});

    const allScheduled = (data || []).map((enrollment: any) => {
      const steps = Array.isArray(enrollment.funnel?.steps) ? enrollment.funnel.steps : [];
      const step = steps[enrollment.current_step] || null;
      const evaluation = evaluateMarketingEnrollment(enrollment, counts[enrollment.contact_id]);
      return {
        ...enrollment,
        current_step_detail: step,
        evaluation,
      };
    });

    const stats = allScheduled.reduce<Record<string, number>>((acc, enrollment: any) => {
      acc[enrollment.evaluation.bucket] = (acc[enrollment.evaluation.bucket] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, { total: 0 });
    const scheduled = allScheduled.filter((enrollment: any) => bucket === 'all' || enrollment.evaluation.bucket === bucket);

    return NextResponse.json({ scheduled, stats });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar envios agendados.');
  }
}
