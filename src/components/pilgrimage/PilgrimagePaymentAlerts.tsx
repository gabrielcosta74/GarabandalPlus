'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { AlertTriangle, CalendarClock, CreditCard, X } from 'lucide-react';
import { usePilgrimagePaymentAlerts } from '../../contexts/PilgrimagePaymentAlertsContext';
import { useLocale } from '../../contexts/LocaleContext';
import {
  buildPaymentBannerDismissKey,
  buildPaymentPopupDismissKey,
  isPaymentAlertSurfaceExcluded,
  shouldShowPaymentAlertBanner,
  shouldShowPaymentAlertPopup,
  type PaymentAlert,
} from '../../lib/pilgrimage-payment-alerts';

const MONEY_FORMATTERS = {
  pt: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }),
  en: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }),
};

const formatAmount = (amount: number, locale: 'pt' | 'en') =>
  MONEY_FORMATTERS[locale].format(amount);

const deadlineText = (alert: PaymentAlert, isEn: boolean) => {
  if (alert.daysUntilDue < 0) {
    const days = Math.abs(alert.daysUntilDue);
    return isEn
      ? `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`
      : `Atrasado há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  if (alert.daysUntilDue === 0) return isEn ? 'Due today' : 'Termina hoje';
  if (alert.daysUntilDue === 1) return isEn ? '1 day left' : 'Falta 1 dia';
  return isEn ? `${alert.daysUntilDue} days left` : `Faltam ${alert.daysUntilDue} dias`;
};

export default function PilgrimagePaymentAlerts() {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const isEn = locale === 'en';
  const { alerts, primaryAlert, userId } = usePilgrimagePaymentAlerts();
  const excluded = isPaymentAlertSurfaceExcluded(pathname);
  const urgentAlert = useMemo(
    () => alerts.find((alert) => shouldShowPaymentAlertPopup(alert)) || null,
    [alerts],
  );
  const urgentCount = useMemo(
    () => alerts.filter((alert) => shouldShowPaymentAlertPopup(alert)).length,
    [alerts],
  );
  const bannerAlert = shouldShowPaymentAlertBanner(primaryAlert) ? primaryAlert : null;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (!userId || !bannerAlert) {
      setBannerDismissed(false);
      return;
    }
    try {
      setBannerDismissed(
        window.sessionStorage.getItem(buildPaymentBannerDismissKey(userId, bannerAlert)) === '1',
      );
    } catch {
      setBannerDismissed(false);
    }
  }, [bannerAlert, userId]);

  useEffect(() => {
    if (!userId || !urgentAlert || excluded) {
      setPopupOpen(false);
      return;
    }
    try {
      const dismissKey = buildPaymentPopupDismissKey(userId, urgentAlert);
      setPopupOpen(window.localStorage.getItem(dismissKey) !== '1');
    } catch {
      setPopupOpen(true);
    }
  }, [excluded, urgentAlert, userId]);

  const dismissBanner = () => {
    if (userId && bannerAlert) {
      try {
        window.sessionStorage.setItem(buildPaymentBannerDismissKey(userId, bannerAlert), '1');
      } catch { /* session storage can be unavailable in private mode */ }
    }
    setBannerDismissed(true);
  };

  const dismissPopup = () => {
    if (userId && urgentAlert) {
      try {
        window.localStorage.setItem(buildPaymentPopupDismissKey(userId, urgentAlert), '1');
      } catch { /* local storage can be unavailable in private mode */ }
    }
    setPopupOpen(false);
  };

  if (!userId || excluded || !primaryAlert) return null;

  const bannerIsOverdue = bannerAlert?.severity === 'overdue';
  const popupIsOverdue = urgentAlert?.severity === 'overdue';

  return (
    <>
      {bannerAlert && !bannerDismissed && (
        <section
          aria-live="polite"
          className={`relative z-[80] border-b px-3 py-3 sm:px-5 ${
            bannerIsOverdue
              ? 'border-red-200 bg-red-50 text-red-950'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <CalendarClock className={`h-5 w-5 shrink-0 ${bannerIsOverdue ? 'text-red-600' : 'text-amber-700'}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">
                {bannerAlert.kind === 'deposit'
                  ? (isEn ? 'Registration fee pending' : 'Taxa de inscrição por pagar')
                  : (isEn ? 'Upcoming pilgrimage payment' : 'Pagamento da peregrinação')}
              </p>
              <p className="truncate text-xs font-semibold opacity-75">
                {bannerAlert.pilgrimageName} · {deadlineText(bannerAlert, isEn)} · {formatAmount(bannerAlert.amountDue, locale)}
              </p>
            </div>
            <Link
              href={bannerAlert.paymentUrl}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-extrabold text-white shadow-sm transition-colors sm:px-4 sm:text-sm ${
                bannerIsOverdue ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'
              }`}
            >
              {isEn ? 'Pay now' : 'Pagar agora'}
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label={isEn ? 'Hide payment notice for this session' : 'Ocultar aviso de pagamento nesta sessão'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-current/60 transition-colors hover:bg-black/5 hover:text-current"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {urgentAlert && (
        <Dialog open={popupOpen} onClose={dismissPopup} className="relative z-[200]">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6">
            <Dialog.Panel className="w-full max-w-lg rounded-t-[28px] bg-white p-5 shadow-2xl md:rounded-[28px] md:p-7">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  popupIsOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-xl font-extrabold leading-tight text-slate-950 md:text-2xl">
                    {popupIsOverdue
                      ? (isEn ? 'Your payment is overdue' : 'O seu pagamento está atrasado')
                      : urgentAlert.kind === 'deposit'
                        ? (isEn ? 'Complete your registration payment' : 'Conclua o pagamento da inscrição')
                        : (isEn ? 'Your next payment is close' : 'A próxima prestação está próxima')}
                  </Dialog.Title>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{urgentAlert.pilgrimageName}</p>
                </div>
                <button
                  type="button"
                  onClick={dismissPopup}
                  aria-label={isEn ? 'Remind me tomorrow' : 'Lembrar amanhã'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className={`my-5 rounded-2xl border p-4 ${
                popupIsOverdue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
              }`}>
                <p className={`text-sm font-extrabold ${popupIsOverdue ? 'text-red-800' : 'text-amber-900'}`}>
                  {deadlineText(urgentAlert, isEn)}
                </p>
                <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                  {formatAmount(urgentAlert.amountDue, locale)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {urgentAlert.kind === 'deposit'
                    ? (isEn ? 'Registration fee' : 'Taxa de inscrição')
                    : (isEn ? 'Next installment' : 'Próxima prestação')}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={dismissPopup}
                  className="min-h-12 rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  {isEn ? 'Remind me tomorrow' : 'Lembrar amanhã'}
                </button>
                <Link
                  href={urgentAlert.paymentUrl}
                  onClick={dismissPopup}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white shadow-md ${
                    popupIsOverdue ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'
                  }`}
                >
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  {isEn ? 'Pay now' : 'Pagar agora'}
                </Link>
              </div>

              {urgentCount > 1 && (
                <Link
                  href={t.urls.myRegistrations}
                  onClick={dismissPopup}
                  className="mt-4 flex min-h-11 items-center justify-center text-sm font-bold text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
                >
                  {isEn
                    ? `View all ${urgentCount} pending payments`
                    : `Ver os ${urgentCount} pagamentos pendentes`}
                </Link>
              )}
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </>
  );
}
