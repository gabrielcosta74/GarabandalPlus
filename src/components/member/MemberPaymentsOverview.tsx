'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  MapPinned,
  RefreshCw,
} from 'lucide-react';
import { usePilgrimagePaymentAlerts } from '../../contexts/PilgrimagePaymentAlertsContext';
import { useLocale } from '../../contexts/LocaleContext';
import { getPilgrimageDisplayName } from '../../lib/pilgrimage-payment-alerts';
import { isActiveMember } from '../../lib/store-discounts';

type MemberPaymentProfile = {
  estado_quota?: string | null;
  is_membro?: boolean | null;
  proxima_quota?: string | null;
  tipo_subscricao?: string | null;
};

type MemberPaymentsOverviewProps = {
  member: MemberPaymentProfile | null;
  quotaPath: string;
};

const MONEY_FORMATTERS = {
  pt: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }),
  en: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }),
};

const formatDate = (value: string, isEnglish: boolean) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return isEnglish ? 'Date to confirm' : 'Data por confirmar';

  return new Intl.DateTimeFormat(isEnglish ? 'en-GB' : 'pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
};

const dueText = (daysUntilDue: number, dueDate: string, isEnglish: boolean) => {
  const date = formatDate(dueDate, isEnglish);
  if (daysUntilDue < 0) {
    const days = Math.abs(daysUntilDue);
    return isEnglish
      ? `Overdue since ${date} · ${days} ${days === 1 ? 'day' : 'days'} late`
      : `Venceu a ${date} · ${days} ${days === 1 ? 'dia' : 'dias'} em atraso`;
  }
  if (daysUntilDue === 0) return isEnglish ? `Due today, ${date}` : `Vence hoje, ${date}`;
  if (daysUntilDue === 1) return isEnglish ? `Due tomorrow, ${date}` : `Vence amanhã, ${date}`;
  return isEnglish
    ? `Due on ${date} · ${daysUntilDue} days left`
    : `Vence a ${date} · faltam ${daysUntilDue} dias`;
};

export default function MemberPaymentsOverview({
  member,
  quotaPath,
}: MemberPaymentsOverviewProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const { alerts, primaryAlert, isLoading, hasError, refresh } = usePilgrimagePaymentAlerts();
  const quotaIsRegular = isActiveMember(member);
  const extraAlerts = primaryAlert ? Math.max(0, alerts.length - 1) : 0;
  const pilgrimageIsOverdue = primaryAlert?.severity === 'overdue';
  const pilgrimageName = primaryAlert
    ? getPilgrimageDisplayName(primaryAlert.pilgrimageName)
    : null;

  const quotaValidity = member?.proxima_quota
    ? (isEnglish
      ? `Valid until ${formatDate(member.proxima_quota, true)}`
      : `Válida até ${formatDate(member.proxima_quota, false)}`)
    : (isEnglish ? 'Renewal date to confirm' : 'Data de renovação por confirmar');

  return (
    <section aria-labelledby="member-payments-title" className="rounded-3xl border border-white/[0.08] bg-slate-900/70 p-4 shadow-xl shadow-black/10 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
          <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="member-payments-title" className="font-serif text-xl font-bold !text-white sm:text-2xl">
            {isEnglish ? 'Payments' : 'Pagamentos'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
            {isEnglish
              ? 'Membership and pilgrimage payments are shown separately.'
              : 'A quota de membro e os pagamentos de peregrinação aparecem separados.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-white/[0.08] bg-slate-950/35 p-5">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              quotaIsRegular
                ? 'border-emerald-400/15 bg-emerald-400/10 text-emerald-300'
                : 'border-rose-400/15 bg-rose-400/10 text-rose-300'
            }`}>
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  {isEnglish ? 'Annual membership fee' : 'Quota anual de membro'}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  quotaIsRegular
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-rose-400/10 text-rose-300'
                }`}>
                  {quotaIsRegular
                    ? (isEnglish ? 'Up to date' : 'Em dia')
                    : (isEnglish ? 'Action needed' : 'Por regularizar')}
                </span>
              </div>
              <h3 className="mt-1.5 text-lg font-bold leading-snug !text-white">
                {quotaIsRegular
                  ? (isEnglish ? 'Membership fee up to date' : 'Quota de membro em dia')
                  : (isEnglish ? 'Membership fee to regularise' : 'Quota de membro por regularizar')}
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-400">{quotaValidity}</p>
            </div>
          </div>

          <Link
            href={quotaPath}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-extrabold !text-white transition-colors hover:border-white/20 hover:bg-white/10 sm:w-fit"
          >
            {isEnglish ? 'Manage annual fee' : 'Gerir quota anual'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </article>

        <article className={`flex flex-col rounded-2xl border bg-slate-950/35 p-5 ${
          pilgrimageIsOverdue ? 'border-rose-400/20' : 'border-white/[0.08]'
        }`}>
          {isLoading ? (
              <div className="animate-pulse" role="status" aria-label={isEnglish ? 'Loading pilgrimage payments' : 'A carregar pagamentos de peregrinações'}>
                <div className="h-10 w-10 rounded-xl bg-slate-700/60" />
                <div className="mt-4 h-3 w-28 rounded bg-slate-700/60" />
                <div className="mt-3 h-6 w-4/5 rounded bg-slate-700/60" />
                <div className="mt-6 h-12 w-full rounded-xl bg-slate-700/50" />
              </div>
            ) : primaryAlert ? (
              <>
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    pilgrimageIsOverdue
                      ? 'border-rose-400/15 bg-rose-400/10 text-rose-300'
                      : 'border-blue-400/15 bg-blue-400/10 text-blue-300'
                  }`}>
                    <CalendarClock className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        {isEnglish ? 'Pilgrimage payment' : 'Pagamento de peregrinação'}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                        pilgrimageIsOverdue
                          ? 'bg-rose-400/10 text-rose-300'
                          : 'bg-blue-400/10 text-blue-300'
                      }`}>
                        {pilgrimageIsOverdue
                          ? (isEnglish ? 'Overdue' : 'Em atraso')
                          : primaryAlert.kind === 'deposit'
                            ? (isEnglish ? 'Registration fee' : 'Taxa de inscrição')
                            : (isEnglish ? 'Next instalment' : 'Próxima prestação')}
                      </span>
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 text-lg font-bold leading-snug !text-white">
                      {pilgrimageName}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 border-t border-white/[0.08] pt-4">
                  <p className="text-2xl font-black tracking-tight !text-white">
                    {MONEY_FORMATTERS[isEnglish ? 'en' : 'pt'].format(primaryAlert.amountDue)}
                  </p>
                  <p className={`mt-1 text-xs font-semibold leading-relaxed ${
                    pilgrimageIsOverdue ? 'text-rose-300' : 'text-slate-400'
                  }`}>
                    {dueText(primaryAlert.daysUntilDue, primaryAlert.dueDate, isEnglish)}
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={primaryAlert.paymentUrl}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 text-sm font-extrabold !text-slate-950 transition-colors hover:bg-[#e2c45e] sm:w-fit"
                  >
                    {isEnglish ? 'View payments' : 'Ver pagamentos'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {extraAlerts > 0 && (
                    <Link
                      href={t.urls.myRegistrations}
                      className="inline-flex min-h-11 items-center justify-center text-xs font-bold !text-slate-300 underline-offset-4 hover:!text-white hover:underline"
                    >
                      {isEnglish
                        ? `View ${extraAlerts} more ${extraAlerts === 1 ? 'payment' : 'payments'}`
                        : `Ver mais ${extraAlerts} ${extraAlerts === 1 ? 'pagamento' : 'pagamentos'}`}
                    </Link>
                  )}
                </div>
              </>
            ) : hasError ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
                    <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                      {isEnglish ? 'Pilgrimages' : 'Peregrinações'}
                    </p>
                    <h3 className="mt-1.5 text-lg font-bold !text-white">
                      {isEnglish ? 'Payments could not be confirmed' : 'Não foi possível confirmar os pagamentos'}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {isEnglish
                        ? 'Try again before assuming that there are no payments due.'
                        : 'Tenta novamente antes de considerar que não existem pagamentos a vencer.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-extrabold !text-white transition-colors hover:border-white/20 hover:bg-white/10 sm:w-fit"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {isEnglish ? 'Try again' : 'Tentar novamente'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/10 text-blue-300">
                    <MapPinned className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                      {isEnglish ? 'Pilgrimages' : 'Peregrinações'}
                    </p>
                    <h3 className="mt-1.5 text-lg font-bold !text-white">
                      {isEnglish ? 'No pilgrimage payments due' : 'Sem pagamentos de peregrinação a vencer'}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {isEnglish
                        ? 'When you have a registration fee or instalment, the amount and deadline will appear here.'
                        : 'Quando existir uma taxa de inscrição ou prestação, o valor e o prazo aparecem aqui.'}
                    </p>
                  </div>
                </div>
                <Link
                  href={t.urls.myRegistrations}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-extrabold !text-white transition-colors hover:border-white/20 hover:bg-white/10 sm:w-fit"
                >
                  {isEnglish ? 'View my registrations' : 'Ver as minhas inscrições'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
          )}
        </article>
      </div>

      <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs font-medium leading-relaxed text-slate-400">
        {isEnglish
          ? 'Pilgrimage balances only appear as overdue after their instalment deadline.'
          : 'Os valores de peregrinação só aparecem em atraso depois do prazo da respetiva prestação.'}
      </p>
    </section>
  );
}
