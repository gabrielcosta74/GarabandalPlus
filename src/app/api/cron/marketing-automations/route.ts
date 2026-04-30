import { NextResponse } from 'next/server';
import { prepareMarketingFunnelEnrollments, processMarketingEnrollment } from '../../../../lib/marketing-automation-engine';
import { countMarketingSendsSince, getMarketingEmailLimits, getMarketingWindowStarts } from '../../../../lib/marketing-limits';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
  }

  const secret = process.env.CRON_SECRET || '';
  if (!secret) {
    return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
  }
  if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requestUrl = new URL(req.url);
    const dryRun = requestUrl.searchParams.get('dryRun') === '1';
    const limits = getMarketingEmailLimits();
    const windows = getMarketingWindowStarts(new Date(), limits);
    const sentLast24h = await countMarketingSendsSince(supabaseServer, windows.day);
    const remainingDailyCapacity = Math.max(0, limits.cronDailySendCap - sentLast24h);
    const batchLimit = Math.min(limits.cronBatchLimit, remainingDailyCapacity);

    const { data: funnels, error: funnelsError } = await supabaseServer
      .from('marketing_funnels')
      .select('*')
      .eq('status', 'active');
    if (funnelsError) throw funnelsError;

    if (dryRun) {
      const { data: dueEnrollments, error: enrollmentError, count } = await supabaseServer
        .from('marketing_enrollments')
        .select('id,current_step,next_run_at,contact:marketing_contacts(id,language,consent_state),funnel:marketing_funnels(id,name,slug,status)', { count: 'exact' })
        .eq('status', 'active')
        .lte('next_run_at', new Date().toISOString())
        .order('next_run_at', { ascending: true })
        .limit(Math.max(1, limits.cronBatchLimit));
      if (enrollmentError) throw enrollmentError;

      return NextResponse.json({
        success: true,
        dryRun: true,
        limits,
        sentLast24h,
        remainingDailyCapacity,
        activeFunnels: (funnels || []).length,
        dueEnrollments: count || 0,
        wouldProcess: Math.min((dueEnrollments || []).length, batchLimit),
        processed: [],
        candidates: (dueEnrollments || []).map((enrollment: any) => ({
          enrollment: enrollment.id,
          currentStep: enrollment.current_step,
          nextRunAt: enrollment.next_run_at,
          language: enrollment.contact?.language || null,
          consentState: enrollment.contact?.consent_state || null,
          funnel: enrollment.funnel?.slug || enrollment.funnel?.name || null,
        })),
      });
    }

    if (batchLimit <= 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'daily_marketing_cap_reached',
        limits,
        sentLast24h,
        activeFunnels: (funnels || []).length,
        enrolled: 0,
        processed: [],
      });
    }

    let enrolled = 0;
    for (const funnel of funnels || []) {
      const result = await prepareMarketingFunnelEnrollments(supabaseServer, funnel, { limit: limits.enrollmentPrepareLimit });
      enrolled += result.enrolled;
    }

    const { data: dueEnrollments, error: enrollmentError } = await supabaseServer
      .from('marketing_enrollments')
      .select('*, contact:marketing_contacts(*), funnel:marketing_funnels(*)')
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(batchLimit);
    if (enrollmentError) throw enrollmentError;

    const processed: any[] = [];
    for (const enrollment of dueEnrollments || []) {
      processed.push(await processMarketingEnrollment(supabaseServer, enrollment));
    }

    return NextResponse.json({
      success: true,
      limits,
      sentLast24h,
      remainingDailyCapacity,
      activeFunnels: (funnels || []).length,
      enrolled,
      processed,
    });
  } catch (error: any) {
    console.error('[Marketing Automations] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
