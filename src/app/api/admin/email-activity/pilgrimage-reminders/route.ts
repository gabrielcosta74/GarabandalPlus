import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';
import { getAppUrl } from '../../../../../lib/config';
import {
  buildReminderReference,
  projectReminderPlan,
  type ReminderBooking,
  type ReminderPlanEntry,
} from '../../../../../lib/pilgrimage-payment-reminders';

export const dynamic = 'force-dynamic';

type AnnotatedTimelineEntry = ReminderPlanEntry & {
  alreadySent: boolean;
  reference: string;
  state: 'sent' | 'today' | 'scheduled' | 'overdue_pending';
};

const resolveContactEmail = async (
  booking: ReminderBooking,
  userEmailCache: Map<string, string | null>,
) => {
  const userId = String(booking.user_id || '').trim();
  if (userId) {
    if (!userEmailCache.has(userId)) {
      const { data, error } = await supabaseServer!.auth.admin.getUserById(userId);
      userEmailCache.set(userId, error ? null : (data?.user?.email || null));
    }

    const authEmail = userEmailCache.get(userId);
    if (authEmail) return authEmail;
  }

  const pilgrimEmail = Array.isArray(booking.pilgrims)
    ? booking.pilgrims
        .map((pilgrim: NonNullable<ReminderBooking['pilgrims']>[number]) => String(pilgrim?.email || '').trim())
        .find((value: string) => value.includes('@'))
    : null;

  return pilgrimEmail || null;
};

const resolveRecipientName = (booking: ReminderBooking) =>
  Array.isArray(booking.pilgrims)
    ? booking.pilgrims
        .map((pilgrim: NonNullable<ReminderBooking['pilgrims']>[number]) => String(pilgrim?.full_name || '').trim())
        .find(Boolean) || null
    : null;

export async function GET(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
  }

  const { authorized, error: authError } = await verifyAdmin(req);
  if (!authorized) {
    const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const asOfParam = searchParams.get('asOf');
    const asOfDate = asOfParam ? new Date(`${asOfParam}T12:00:00Z`) : null;
    const now = asOfDate && !Number.isNaN(asOfDate.getTime()) ? asOfDate : new Date();

    const { data: bookings, error } = await supabaseServer
      .from('bookings')
      .select(`
        id,
        user_id,
        created_at,
        total_amount,
        paid_amount,
        status,
        view_token,
        payment_plan,
        pilgrimage:pilgrimages (
          title,
          deposit_value
        ),
        pilgrims (
          birth_date,
          full_name,
          email
        ),
        payments:pilgrimage_payments (
          id,
          amount,
          status,
          method,
          created_at,
          receipt_url
        )
      `)
      .neq('status', 'cancelled');

    if (error) {
      return NextResponse.json({ error: error.message || 'Erro ao carregar reservas.' }, { status: 500 });
    }

    const appUrl = getAppUrl();
    const userEmailCache = new Map<string, string | null>();
    const plans = [];
    const references: string[] = [];

    for (const booking of (bookings || []) as ReminderBooking[]) {
      const email = await resolveContactEmail(booking, userEmailCache);
      const recipientName = resolveRecipientName(booking);

      const plan = projectReminderPlan(booking, {
        email,
        recipientName,
        appUrl,
        now,
      });

      if (!plan) continue;

      references.push(
        ...plan.timeline.map((entry) =>
          buildReminderReference(plan.bookingId, plan.obligationKey, entry.notificationType, plan.dueDate),
        ),
      );

      plans.push(plan);
    }

    const uniqueReferences = Array.from(new Set(references));
    const sentRecords = uniqueReferences.length
      ? await supabaseServer
          .from('email_notifications')
          .select('reference, sent_at')
          .in('reference', uniqueReferences)
      : { data: [], error: null };

    if (sentRecords.error) {
      return NextResponse.json({ error: sentRecords.error.message || 'Erro ao carregar histórico de emails.' }, { status: 500 });
    }

    const sentMap = new Map<string, boolean>();
    for (const row of sentRecords.data || []) {
      sentMap.set(String(row.reference || ''), Boolean(row.sent_at));
    }

    const results = plans
      .map((plan) => {
        const timeline: AnnotatedTimelineEntry[] = plan.timeline.map((entry) => {
          const reference = buildReminderReference(
            plan.bookingId,
            plan.obligationKey,
            entry.notificationType,
            plan.dueDate,
          );
          const alreadySent = sentMap.get(reference) === true;
          const state = alreadySent
            ? 'sent'
            : entry.isToday
              ? 'today'
              : entry.isFuture
                ? 'scheduled'
                : 'overdue_pending';

          return {
            ...entry,
            alreadySent,
            reference,
            state,
          };
        });

        const nextPlanned = timeline.find((entry) => !entry.alreadySent && (entry.isToday || entry.isFuture))
          || timeline.find((entry) => !entry.alreadySent);

        const currentAction = plan.currentStage
          ? timeline.find((entry) => entry.notificationType === plan.currentStage?.notificationType) || null
          : null;

        return {
          bookingId: plan.bookingId,
          recipientName: plan.recipientName,
          email: plan.email,
          pilgrimageName: plan.pilgrimageName,
          bookingUrl: plan.bookingUrl,
          obligationKey: plan.obligationKey,
          obligationLabel: plan.obligationLabel,
          reminderKind: plan.reminderKind,
          amountDue: plan.remainingAmount,
          totalRemaining: plan.totalRemaining,
          dueDate: plan.dueDate,
          nextPlanned,
          currentAction,
          timeline,
        };
      })
      .sort((left, right) => {
        const leftDate = left.nextPlanned?.scheduledFor || left.dueDate;
        const rightDate = right.nextPlanned?.scheduledFor || right.dueDate;
        return new Date(leftDate).getTime() - new Date(rightDate).getTime();
      });

    const summary = {
      totalBookings: results.length,
      deposits: results.filter((entry) => entry.reminderKind === 'deposit').length,
      installments: results.filter((entry) => entry.reminderKind === 'installment').length,
      sendToday: results.filter((entry) => entry.currentAction && !entry.currentAction.alreadySent).length,
      upcomingNext7Days: results.filter((entry) => {
        const next = entry.nextPlanned;
        if (!next || next.alreadySent) return false;
        const diff = Math.round((new Date(next.scheduledFor).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return diff >= 0 && diff <= 7;
      }).length,
    };

    return NextResponse.json({
      asOf: now.toISOString(),
      summary,
      reminders: results,
    });
  } catch (error: any) {
    console.error('[Admin Pilgrimage Reminder Schedule] Failed', error);
    return NextResponse.json(
      { error: String(error?.message || 'Não foi possível carregar a agenda de lembretes.') },
      { status: 500 },
    );
  }
}
