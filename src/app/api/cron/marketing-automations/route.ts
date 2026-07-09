import { NextResponse } from 'next/server';
import {
  getMarketingStepConditions,
  getMarketingEnrollmentStep,
  prepareMarketingFunnelEnrollments,
  processMarketingEnrollment,
  processWaitlistOpenSpotNotifications,
} from '../../../../lib/marketing-automation-engine';
import {
  countMarketingSendsSince,
  getMarketingEmailLimits,
  getMarketingSendWindow,
  getMarketingWindowStarts,
  isWithinMarketingSendWindow,
} from '../../../../lib/marketing-limits';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getContactValue = (contact: any) => {
  const summary = contact?.source_summary || {};
  return (
    Number(summary.donation_value || 0) +
    Number(summary.quota_value || 0) +
    Number(summary.store_value || 0) +
    Number(summary.pilgrimage_payment_value || 0)
  );
};

const sortDueEnrollments = (rows: any[] = []) =>
  [...rows].sort((a, b) => {
    const scoreDiff = Number(b.contact?.lead_score || 0) - Number(a.contact?.lead_score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const valueDiff = getContactValue(b.contact) - getContactValue(a.contact);
    if (valueDiff !== 0) return valueDiff;
    return new Date(a.next_run_at || 0).getTime() - new Date(b.next_run_at || 0).getTime();
  });

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

    // Quiet hours: fora da janela (hora de São Paulo) nada é enviado; os
    // enrollments devidos saem na primeira corrida dentro da janela.
    if (!dryRun && !isWithinMarketingSendWindow()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'quiet_hours',
        sendWindow: getMarketingSendWindow(),
        processed: [],
      });
    }

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
      const waitlistOpenSpot = await processWaitlistOpenSpotNotifications(supabaseServer, {
        limit: Math.max(1, Math.min(limits.cronBatchLimit, remainingDailyCapacity || limits.cronBatchLimit)),
        dryRun: true,
      });

      const { data: dueEnrollments, error: enrollmentError, count } = await supabaseServer
        .from('marketing_enrollments')
        .select('id,current_step,next_run_at,contact:marketing_contacts(id,language,consent_state,lead_score,source_summary),funnel:marketing_funnels(id,name,slug,status,steps)', { count: 'exact' })
        .eq('status', 'active')
        .lte('next_run_at', new Date().toISOString())
        .order('next_run_at', { ascending: true })
        .limit(Math.max(1, limits.cronBatchLimit * 3));
      if (enrollmentError) throw enrollmentError;
      const sortedDueEnrollments = sortDueEnrollments(dueEnrollments || []).slice(0, Math.max(1, limits.cronBatchLimit));

      return NextResponse.json({
        success: true,
        dryRun: true,
        limits,
        sentLast24h,
        remainingDailyCapacity,
        activeFunnels: (funnels || []).length,
        dueEnrollments: count || 0,
        waitlistOpenSpot,
        wouldProcess: Math.min(sortedDueEnrollments.length, batchLimit),
        processed: [],
        candidates: sortedDueEnrollments.map((enrollment: any) => {
          const { step } = getMarketingEnrollmentStep(enrollment);
          return {
            enrollment: enrollment.id,
            currentStep: enrollment.current_step,
            nextRunAt: enrollment.next_run_at,
            language: enrollment.contact?.language || null,
            consentState: enrollment.contact?.consent_state || null,
            leadScore: enrollment.contact?.lead_score || 0,
            contactValue: getContactValue(enrollment.contact),
            funnel: enrollment.funnel?.slug || enrollment.funnel?.name || null,
            templateKey: step?.template_key || null,
            effectiveConditions: getMarketingStepConditions(step),
          };
        }),
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

    const waitlistOpenSpot = await processWaitlistOpenSpotNotifications(supabaseServer, {
      limit: batchLimit,
    });
    const enrollmentBatchLimit = Math.max(0, batchLimit - waitlistOpenSpot.sent);

    const { data: dueEnrollments, error: enrollmentError } = enrollmentBatchLimit > 0
      ? await supabaseServer
          .from('marketing_enrollments')
          .select('*, contact:marketing_contacts(*), funnel:marketing_funnels(*)')
          .eq('status', 'active')
          .lte('next_run_at', new Date().toISOString())
          .order('next_run_at', { ascending: true })
          .limit(Math.max(enrollmentBatchLimit * 3, enrollmentBatchLimit))
      : { data: [], error: null };
    if (enrollmentError) throw enrollmentError;

    const processed: any[] = [];
    for (const enrollment of sortDueEnrollments(dueEnrollments || []).slice(0, enrollmentBatchLimit)) {
      processed.push(await processMarketingEnrollment(supabaseServer, enrollment));
    }

    return NextResponse.json({
      success: true,
      limits,
      sentLast24h,
      remainingDailyCapacity,
      activeFunnels: (funnels || []).length,
      enrolled,
      waitlistOpenSpot,
      processed,
    });
  } catch (error: any) {
    console.error('[Marketing Automations] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
