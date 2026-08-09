export type PaymentAlertSeverity = 'info' | 'warning' | 'urgent' | 'overdue';

export type PaymentAlert = {
  bookingId: string;
  pilgrimageName: string;
  obligationKey: string;
  kind: 'deposit' | 'installment';
  amountDue: number;
  totalRemaining: number;
  dueDate: string;
  daysUntilDue: number;
  severity: PaymentAlertSeverity;
  paymentUrl: string;
};

export type PaymentAlertsResponse = {
  alerts: PaymentAlert[];
  generatedAt: string;
};

const PRIVATE_TEST_PILGRIMAGE_PREFIX = /^\[TESTE PRIVADO FACT\.pt\]\s*/i;

export const getPilgrimageDisplayName = (name: string) =>
  name.replace(PRIVATE_TEST_PILGRIMAGE_PREFIX, '');

export const getPaymentAlertSeverity = (daysUntilDue: number): PaymentAlertSeverity => {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 2) return 'urgent';
  if (daysUntilDue <= 7) return 'warning';
  return 'info';
};

export const comparePaymentAlerts = (left: PaymentAlert, right: PaymentAlert) => {
  if (left.daysUntilDue !== right.daysUntilDue) {
    return left.daysUntilDue - right.daysUntilDue;
  }
  if (left.kind !== right.kind) return left.kind === 'deposit' ? -1 : 1;
  return left.bookingId.localeCompare(right.bookingId);
};

export const shouldShowPaymentAlertBanner = (alert: PaymentAlert | null | undefined) =>
  Boolean(alert && (alert.kind === 'deposit' || alert.daysUntilDue <= 7));

export const shouldShowPaymentAlertPopup = (alert: PaymentAlert | null | undefined) =>
  Boolean(alert && alert.daysUntilDue <= 2);

const ROUTE_PREFIXES_WITHOUT_PAYMENT_ALERTS = [
  '/admin',
  '/embed',
  '/login',
  '/register',
  '/auth',
  '/auth-callback',
  '/en/login',
  '/en/register',
  '/en/auth',
  '/en/auth-callback',
  '/loja-online/checkout',
  '/en/store/checkout',
  '/thank-you',
  '/en/thank-you',
  '/payments',
  '/peregrinacoes/inscricao',
  '/en/pilgrimages/registration',
];

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isPaymentAlertSurfaceExcluded = (pathname: string | null | undefined) => {
  const value = pathname || '/';
  if (ROUTE_PREFIXES_WITHOUT_PAYMENT_ALERTS.some((prefix) => matchesPrefix(value, prefix))) {
    return true;
  }

  return /^\/peregrinacoes\/[^/]+\/inscrever(?:\/|$)/.test(value)
    || /^\/en\/pilgrimages\/[^/]+\/register(?:\/|$)/.test(value);
};

const localDayKey = (now: Date) => [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

export const buildPaymentPopupDismissKey = (
  userId: string,
  alert: PaymentAlert,
  now: Date = new Date(),
) => [
  'pilgrimage-payment-popup',
  userId,
  alert.bookingId,
  alert.obligationKey,
  alert.dueDate.slice(0, 10),
  localDayKey(now),
].join(':');

export const buildPaymentBannerDismissKey = (userId: string, alert: PaymentAlert) => [
  'pilgrimage-payment-banner',
  userId,
  alert.bookingId,
  alert.obligationKey,
  alert.dueDate.slice(0, 10),
].join(':');
