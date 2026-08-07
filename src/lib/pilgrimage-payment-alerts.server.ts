/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  resolveOutstandingPaymentObligation,
  type ReminderBooking,
} from './pilgrimage-payment-reminders';
import { daysBetweenUtc } from './pilgrimage-payment-deadlines';
import {
  comparePaymentAlerts,
  getPaymentAlertSeverity,
  type PaymentAlert,
} from './pilgrimage-payment-alerts';

const singleRelation = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function loadUserPaymentAlerts(
  supabase: any,
  options: {
    userId: string;
    locale: 'pt' | 'en';
    now?: Date;
  },
): Promise<PaymentAlert[]> {
  const now = options.now || new Date();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      created_at,
      total_amount,
      paid_amount,
      status,
      payment_plan,
      pilgrimage:pilgrimages!inner (
        title,
        deposit_value,
        start_date,
        end_date
      ),
      pilgrims (
        birth_date,
        full_name
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
    .eq('user_id', options.userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const alerts = (data || []).flatMap((rawBooking: any): PaymentAlert[] => {
    if (String(rawBooking.user_id || '') !== options.userId) return [];
    if (['cancelled', 'canceled'].includes(String(rawBooking.status || '').toLowerCase())) return [];
    const pilgrimage = singleRelation(rawBooking.pilgrimage) as ReminderBooking['pilgrimage'];
    if (!pilgrimage?.start_date) return [];

    const startDate = new Date(pilgrimage.start_date);
    if (Number.isNaN(startDate.getTime()) || daysBetweenUtc(now, startDate) < 0) return [];

    const booking: ReminderBooking = {
      ...rawBooking,
      pilgrimage,
      pilgrims: Array.isArray(rawBooking.pilgrims) ? rawBooking.pilgrims : [],
      payments: Array.isArray(rawBooking.payments) ? rawBooking.payments : [],
    };
    const obligation = resolveOutstandingPaymentObligation(booking, { now });
    if (!obligation) return [];

    const dueDate = new Date(obligation.dueDate);
    if (Number.isNaN(dueDate.getTime())) return [];
    const daysUntilDue = daysBetweenUtc(now, dueDate);
    const paymentUrl = options.locale === 'en'
      ? `/en/pilgrimages/registration/${encodeURIComponent(obligation.bookingId)}`
      : `/peregrinacoes/inscricao/${encodeURIComponent(obligation.bookingId)}`;

    return [{
      bookingId: obligation.bookingId,
      pilgrimageName: obligation.pilgrimageName,
      obligationKey: obligation.obligationKey,
      kind: obligation.obligationKey === 'deposit' ? 'deposit' : 'installment',
      amountDue: obligation.remainingAmount,
      totalRemaining: obligation.totalRemaining,
      dueDate: obligation.dueDate,
      daysUntilDue,
      severity: getPaymentAlertSeverity(daysUntilDue),
      paymentUrl,
    }];
  });

  return alerts.sort(comparePaymentAlerts);
}
