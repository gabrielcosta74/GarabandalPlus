import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/config';
import { ensureNotificationRecord, markNotificationSent } from '../../../../lib/email-notifications';
import { sendPilgrimagePaymentReminderEmail } from '../../../../lib/email';
import { resolveReminderCandidate, type ReminderBooking } from '../../../../lib/pilgrimage-payment-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const getExistingNotification = async (type: string, reference: string) => {
  const { data, error } = await supabaseServer!
    .from('email_notifications')
    .select('id, sent_at')
    .eq('type', type)
    .eq('reference', reference)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[Pilgrimage Payment Reminders] Failed to peek notification state', error);
    return null;
  }

  return data;
};

export async function GET(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });
  }

  const secret = process.env.CRON_SECRET || '';
  if (!secret) {
    return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const dryRun = requestUrl.searchParams.get('dryRun') === '1';
  const asOfParam = requestUrl.searchParams.get('asOf');
  const asOfDate = asOfParam ? new Date(`${asOfParam}T12:00:00Z`) : null;
  const effectiveNow = asOfDate && !Number.isNaN(asOfDate.getTime()) ? asOfDate : new Date();

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
    return NextResponse.json({ message: 'Erro ao carregar reservas', error: error.message }, { status: 500 });
  }

  const appUrl = getAppUrl();
  const userEmailCache = new Map<string, string | null>();
  const results: Array<Record<string, unknown>> = [];

  for (const booking of (bookings || []) as ReminderBooking[]) {
    try {
      const email = await resolveContactEmail(booking, userEmailCache);
      const recipientName = resolveRecipientName(booking);

      const candidate = resolveReminderCandidate(booking, {
        email,
        recipientName,
        appUrl,
        now: effectiveNow,
      });

      if (!candidate) continue;

      const reference = [
        candidate.bookingId,
        candidate.obligationKey,
        candidate.stage.notificationType,
        candidate.dueDate.slice(0, 10),
      ].join(':');

      if (dryRun) {
        const existing = await getExistingNotification(candidate.stage.notificationType, reference);
        results.push({
          bookingId: candidate.bookingId,
          pilgrimageName: candidate.pilgrimageName,
          recipientName: candidate.recipientName,
          email: candidate.email,
          obligationKey: candidate.obligationKey,
          obligationLabel: candidate.obligationLabel,
          stage: candidate.stage.kind,
          notificationType: candidate.stage.notificationType,
          amountDue: candidate.remainingAmount,
          totalRemaining: candidate.totalRemaining,
          dueDate: candidate.dueDate,
          bookingUrl: candidate.bookingUrl,
          alreadySent: Boolean(existing?.sent_at),
          action: existing?.sent_at ? 'would_skip_already_sent' : 'would_send',
          success: true,
        });
        continue;
      }

      const notification = await ensureNotificationRecord(supabaseServer, {
        type: candidate.stage.notificationType as any,
        reference,
        userId: candidate.userId ?? null,
        email: candidate.email,
      });

      if (!notification.shouldSend) {
        results.push({ bookingId: candidate.bookingId, action: `skip_${candidate.stage.notificationType}`, success: true });
        continue;
      }

      const sent = await sendPilgrimagePaymentReminderEmail({
        toEmail: candidate.email,
        recipientName: candidate.recipientName,
        pilgrimageName: candidate.pilgrimageName,
        obligationLabel: candidate.obligationLabel,
        dueDate: candidate.dueDate,
        amountDue: candidate.remainingAmount,
        totalRemaining: candidate.totalRemaining,
        bookingUrl: candidate.bookingUrl,
        stage: candidate.stage.kind,
      });

      if (!sent) {
        results.push({
          bookingId: candidate.bookingId,
          action: `email_not_sent_${candidate.stage.notificationType}`,
          success: false,
        });
        continue;
      }

      await markNotificationSent(supabaseServer, notification.recordId);
      results.push({ bookingId: candidate.bookingId, action: `notify_${candidate.stage.notificationType}`, success: true });
    } catch (err) {
      console.error('[Pilgrimage Payment Reminders] Failed booking', booking.id, err);
      results.push({ bookingId: booking.id, action: 'error', success: false });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    asOf: effectiveNow.toISOString(),
    processed: results.length,
    details: results,
  });
}
