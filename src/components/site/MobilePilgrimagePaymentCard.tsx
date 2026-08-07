'use client';

import Link from 'next/link';
import { ChevronRight, Ticket } from 'lucide-react';
import { usePilgrimagePaymentAlerts } from '../../contexts/PilgrimagePaymentAlertsContext';
import type { PaymentAlert } from '../../lib/pilgrimage-payment-alerts';

const MONEY_FORMATTERS = {
  pt: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }),
  en: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }),
};

const paymentDescription = (alert: PaymentAlert, isEnglish: boolean) => {
  const money = MONEY_FORMATTERS[isEnglish ? 'en' : 'pt'].format(alert.amountDue);
  if (alert.daysUntilDue < 0) {
    const days = Math.abs(alert.daysUntilDue);
    return isEnglish
      ? `Payment overdue by ${days} ${days === 1 ? 'day' : 'days'} · ${money}`
      : `Pagamento atrasado há ${days} ${days === 1 ? 'dia' : 'dias'} · ${money}`;
  }
  if (alert.kind === 'deposit') {
    return isEnglish ? `Registration fee pending · ${money}` : `Taxa de inscrição por pagar · ${money}`;
  }
  if (alert.daysUntilDue === 0) {
    return isEnglish ? `Next installment due today · ${money}` : `Próxima prestação termina hoje · ${money}`;
  }
  if (alert.daysUntilDue === 1) {
    return isEnglish ? `Next installment due tomorrow · ${money}` : `Próxima prestação amanhã · ${money}`;
  }
  return isEnglish
    ? `Next installment in ${alert.daysUntilDue} days · ${money}`
    : `Próxima prestação em ${alert.daysUntilDue} dias · ${money}`;
};

type MobilePilgrimagePaymentCardProps = {
  href: string;
  isAuthenticated: boolean;
  isEnglish: boolean;
  isActive?: boolean;
  onClick: () => void;
};

export default function MobilePilgrimagePaymentCard({
  href,
  isAuthenticated,
  isEnglish,
  isActive = false,
  onClick,
}: MobilePilgrimagePaymentCardProps) {
  const { alerts, primaryAlert } = usePilgrimagePaymentAlerts();
  const title = isEnglish ? 'My Registrations' : 'Minhas Inscrições';
  const activeAlert = isAuthenticated ? primaryAlert : null;
  const description = activeAlert
    ? paymentDescription(activeAlert, isEnglish)
    : isAuthenticated
      ? (isEnglish ? 'View payments and pay your pilgrimage' : 'Ver pagamentos e pagar a peregrinação')
      : (isEnglish ? 'Sign in to view registrations and payments' : 'Entre para ver inscrições e pagamentos');
  const extraAlerts = activeAlert ? Math.max(0, alerts.length - 1) : 0;
  const cardHref = activeAlert?.paymentUrl || href;
  const isOverdue = activeAlert?.severity === 'overdue';

  return (
    <Link
      href={cardHref}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`group mb-7 block rounded-2xl border p-4 shadow-md transition-all active:scale-[0.99] ${
        isActive
          ? 'border-garabandal-gold bg-garabandal-gold text-garabandal-dark'
          : isOverdue
            ? 'border-red-300 bg-gradient-to-br from-red-50 to-rose-100 text-garabandal-dark hover:border-red-400 hover:shadow-lg'
          : 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 text-garabandal-dark hover:border-garabandal-gold hover:shadow-lg'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
          <Ticket className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">{title}</span>
          <span className="mt-1 block text-xs font-semibold leading-snug text-slate-600">{description}</span>
          {extraAlerts > 0 && (
            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              isOverdue ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-900'
            }`}>
              {isEnglish
                ? `+${extraAlerts} pending ${extraAlerts === 1 ? 'payment' : 'payments'}`
                : `+${extraAlerts} ${extraAlerts === 1 ? 'pagamento pendente' : 'pagamentos pendentes'}`}
            </span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-amber-800 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
