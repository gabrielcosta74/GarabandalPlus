import { calculateInstallmentStatus, type Payment } from './utils';
import { isPaymentAwaitingReceiptValidation } from './pilgrimage-payments';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONEY_TOLERANCE = 0.01;

export type ReminderStageKind =
  | 'upcoming_3d'
  | 'upcoming_1d'
  | 'upcoming_7d'
  | 'upcoming_2d'
  | 'due_today'
  | 'overdue_2d'
  | 'overdue_5d'
  | 'overdue_3d'
  | 'overdue_10d';

export type ReminderNotificationType =
  | 'pilgrimage_deposit_reminder_3d'
  | 'pilgrimage_deposit_reminder_1d'
  | 'pilgrimage_deposit_due_today'
  | 'pilgrimage_deposit_overdue_2d'
  | 'pilgrimage_deposit_overdue_5d'
  | 'pilgrimage_payment_reminder_7d'
  | 'pilgrimage_payment_reminder_2d'
  | 'pilgrimage_payment_due_today'
  | 'pilgrimage_payment_overdue_3d'
  | 'pilgrimage_payment_overdue_10d';

export type ReminderStage = {
  kind: ReminderStageKind;
  notificationType: ReminderNotificationType;
  diffDays: number;
};

export type ReminderCandidate = {
  bookingId: string;
  userId?: string | null;
  email: string;
  recipientName: string;
  pilgrimageName: string;
  bookingUrl: string;
  obligationKey: string;
  obligationLabel: string;
  dueDate: string;
  expectedAmount: number;
  remainingAmount: number;
  totalAmount: number;
  paidAmount: number;
  totalRemaining: number;
  stage: ReminderStage;
};

export type ReminderBooking = {
  id: string;
  user_id?: string | null;
  created_at?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  status?: string | null;
  view_token?: string | null;
  payment_plan?: unknown;
  pilgrimage?: {
    title?: string | null;
    deposit_value?: number | string | null;
  } | null;
  pilgrims?: Array<{
    birth_date?: string | null;
    full_name?: string | null;
    email?: string | null;
  }> | null;
  payments?: Payment[] | null;
};

const DEPOSIT_REMINDER_STAGES: ReminderStage[] = [
  { kind: 'upcoming_3d', notificationType: 'pilgrimage_deposit_reminder_3d', diffDays: 3 },
  { kind: 'upcoming_1d', notificationType: 'pilgrimage_deposit_reminder_1d', diffDays: 1 },
  { kind: 'due_today', notificationType: 'pilgrimage_deposit_due_today', diffDays: 0 },
  { kind: 'overdue_2d', notificationType: 'pilgrimage_deposit_overdue_2d', diffDays: -2 },
  { kind: 'overdue_5d', notificationType: 'pilgrimage_deposit_overdue_5d', diffDays: -5 },
];

const INSTALLMENT_REMINDER_STAGES: ReminderStage[] = [
  { kind: 'upcoming_7d', notificationType: 'pilgrimage_payment_reminder_7d', diffDays: 7 },
  { kind: 'upcoming_2d', notificationType: 'pilgrimage_payment_reminder_2d', diffDays: 2 },
  { kind: 'due_today', notificationType: 'pilgrimage_payment_due_today', diffDays: 0 },
  { kind: 'overdue_3d', notificationType: 'pilgrimage_payment_overdue_3d', diffDays: -3 },
  { kind: 'overdue_10d', notificationType: 'pilgrimage_payment_overdue_10d', diffDays: -10 },
];

const normalizeNumber = (value: unknown) => Number(value || 0);

const normalizeString = (value: unknown) => String(value || '').trim();

const toUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));

export const daysBetweenUtc = (from: Date, to: Date) => {
  const diff = toUtcDay(to).getTime() - toUtcDay(from).getTime();
  return Math.round(diff / DAY_MS);
};

const addDays = (value: string, days: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

export const parsePaymentPlan = (
  value: unknown,
): Array<{ date: string; amount: number }> => {
  const parsed =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      date: normalizeString((item as any)?.date),
      amount: normalizeNumber((item as any)?.amount),
    }))
    .filter((item) => item.date && item.amount > MONEY_TOLERANCE);
};

export const countDepositEligiblePilgrims = (
  pilgrims: ReminderBooking['pilgrims'],
  now: Date = new Date(),
) => {
  if (!Array.isArray(pilgrims) || pilgrims.length === 0) return 1;

  let eligible = 0;

  for (const pilgrim of pilgrims) {
    const birthDateValue = normalizeString(pilgrim?.birth_date);
    if (!birthDateValue) {
      eligible += 1;
      continue;
    }

    const birthDate = new Date(birthDateValue);
    if (Number.isNaN(birthDate.getTime())) {
      eligible += 1;
      continue;
    }

    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    if (age > 2) {
      eligible += 1;
    }
  }

  return eligible;
};

export const buildBookingAccessUrl = (appUrl: string, bookingId: string, viewToken?: string | null) => {
  const baseUrl = `${appUrl.replace(/\/$/, '')}/peregrinacoes/inscricao/${bookingId}`;
  const token = normalizeString(viewToken);

  if (!token) return baseUrl;

  const encoded = encodeURIComponent(token);
  return `${baseUrl}?viewToken=${encoded}&token=${encoded}`;
};

const getReminderStage = (diffDays: number, stages: ReminderStage[]) =>
  stages.find((stage) => stage.diffDays === diffDays) || null;

const sumPendingReceiptValidationAmount = (payments: Payment[] = []) =>
  payments
    .filter((payment) => isPaymentAwaitingReceiptValidation(payment))
    .reduce((sum, payment) => sum + normalizeNumber(payment.amount), 0);

export const resolveReminderCandidate = (
  booking: ReminderBooking,
  options: {
    email?: string | null;
    recipientName?: string | null;
    appUrl: string;
    now?: Date;
  },
): ReminderCandidate | null => {
  const now = options.now || new Date();
  const totalAmount = normalizeNumber(booking.total_amount);
  const paidAmount = normalizeNumber(booking.paid_amount);
  const totalRemaining = Math.max(0, totalAmount - paidAmount);
  const bookingStatus = normalizeString(booking.status).toLowerCase();

  if (totalRemaining <= MONEY_TOLERANCE) return null;
  if (bookingStatus === 'cancelled') return null;

  const paymentPlan = parsePaymentPlan(booking.payment_plan);
  const depositPerPerson = normalizeNumber(booking.pilgrimage?.deposit_value);
  const depositAmount = Math.max(
    0,
    depositPerPerson * countDepositEligiblePilgrims(booking.pilgrims, now),
  );

  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const installments = calculateInstallmentStatus(paidAmount, depositAmount, paymentPlan, payments);

  const obligations = installments
    .map((installment, index) => ({
      obligationKey: index === 0 ? 'deposit' : `installment_${index}`,
      obligationLabel: installment.label,
      dueDate:
        index === 0
          ? addDays(normalizeString(booking.created_at), 5) || ''
          : normalizeString(installment.dueDate),
      expectedAmount: normalizeNumber(installment.expectedAmount),
      remainingAmount: Math.max(0, normalizeNumber(installment.remainingAmount)),
    }))
    .filter(
      (installment) =>
        installment.expectedAmount > MONEY_TOLERANCE &&
        installment.remainingAmount > MONEY_TOLERANCE &&
        installment.dueDate,
    );

  const activeObligation = obligations[0];
  if (!activeObligation) return null;

  const pendingValidationAmount = sumPendingReceiptValidationAmount(payments);
  if (pendingValidationAmount >= activeObligation.remainingAmount - MONEY_TOLERANCE) {
    return null;
  }

  const dueDate = new Date(activeObligation.dueDate);
  if (Number.isNaN(dueDate.getTime())) return null;

  const stage = getReminderStage(
    daysBetweenUtc(now, dueDate),
    activeObligation.obligationKey === 'deposit'
      ? DEPOSIT_REMINDER_STAGES
      : INSTALLMENT_REMINDER_STAGES,
  );
  if (!stage) return null;

  const email = normalizeString(options.email);
  if (!email) return null;

  const recipientName =
    normalizeString(options.recipientName) ||
    normalizeString(booking.pilgrims?.[0]?.full_name) ||
    'Peregrino';

  return {
    bookingId: booking.id,
    userId: booking.user_id || null,
    email,
    recipientName,
    pilgrimageName: normalizeString(booking.pilgrimage?.title) || 'Peregrinação',
    bookingUrl: buildBookingAccessUrl(options.appUrl, booking.id, booking.view_token),
    obligationKey: activeObligation.obligationKey,
    obligationLabel: activeObligation.obligationLabel,
    dueDate: dueDate.toISOString(),
    expectedAmount: activeObligation.expectedAmount,
    remainingAmount: activeObligation.remainingAmount,
    totalAmount,
    paidAmount,
    totalRemaining,
    stage,
  };
};
