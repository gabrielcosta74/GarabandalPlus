import { NextResponse } from 'next/server';
import { buildMarketingContacts, buildMarketingOverview } from '../../../../../lib/marketing-data';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const contacts = await buildMarketingContacts(auth.supabase);
    const overview = buildMarketingOverview(contacts);

    const [{ data: campaigns }, { data: funnels }, { data: upcomingEnrollments }, { data: failedMessages }] = await Promise.all([
      auth.supabase.from('marketing_campaigns').select('id,name,status,segment_slug,scheduled_at,metrics,created_at').order('created_at', { ascending: false }).limit(8),
      auth.supabase.from('marketing_funnels').select('id,name,slug,status,segment_slug,trigger_type,steps,metrics').order('created_at', { ascending: false }),
      auth.supabase
        .from('marketing_enrollments')
        .select('id,current_step,next_run_at,funnel:marketing_funnels(name,slug,steps),contact:marketing_contacts(display_name,normalized_email)')
        .eq('status', 'active')
        .not('next_run_at', 'is', null)
        .order('next_run_at', { ascending: true })
        .limit(12),
      auth.supabase.from('marketing_message_logs').select('id,to_email,subject,status,error_message,created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(10),
    ]);

    // Fila dos próximos envios: o que o cron vai processar, mostrado antes de acontecer.
    const upcoming = (upcomingEnrollments || []).map((enrollment: any) => {
      const steps = Array.isArray(enrollment.funnel?.steps) ? enrollment.funnel.steps : [];
      const step = steps[enrollment.current_step || 0] || null;
      return {
        id: enrollment.id,
        next_run_at: enrollment.next_run_at,
        funnel_name: enrollment.funnel?.name || enrollment.funnel?.slug || '—',
        funnel_slug: enrollment.funnel?.slug || null,
        template_key: step?.template_key || null,
        step_number: (enrollment.current_step || 0) + 1,
        total_steps: steps.length,
        contact_name: enrollment.contact?.display_name || null,
        contact_email: enrollment.contact?.normalized_email || null,
      };
    });

    return NextResponse.json({
      ...overview,
      campaigns: campaigns || [],
      funnels: funnels || [],
      upcoming,
      failedMessages: failedMessages || [],
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar marketing.');
  }
}
