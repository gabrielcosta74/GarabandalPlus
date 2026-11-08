"use client";

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarClock, ChevronDown, FileUp, Landmark, RefreshCw, TriangleAlert } from 'lucide-react';

import type { BankInfo } from './useLedger';
import { formatDay, formatEur } from '../../../lib/ledger/format';
import { Button, IconButton, cx } from './ui';

/**
 * Automatic reads (Railway cron "0 7,12,17 * * *", which runs in UTC):
 * 07:00, 12:00 and 17:00 in Lisbon in winter, one hour later in summer.
 * Keep in sync with the cron schedule of the "contabilidade-sync" service.
 */
export const AUTOMATIC_SYNC_HOURS_UTC = [7, 12, 17];

const LISBON = 'Europe/Lisbon';

function lisbonParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LISBON, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** The next automatic read at or after `from`. */
export function nextAutomaticSync(from: Date): Date {
  for (let dayShift = 0; dayShift < 3; dayShift += 1) {
    for (const hour of AUTOMATIC_SYNC_HOURS_UTC) {
      const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + dayShift, hour, 0));
      if (candidate.getTime() >= from.getTime()) return candidate;
    }
  }
  return new Date(from.getTime() + 86400000);
}

function relative(iso: string, now: number): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function clock(date: Date, now: number): string {
  const time = date.toLocaleTimeString('pt-PT', { timeZone: LISBON, hour: '2-digit', minute: '2-digit' });
  const today = lisbonParts(new Date(now));
  const target = lisbonParts(date);
  if (target.day === today.day && target.month === today.month) return `às ${time}`;
  const tomorrow = lisbonParts(new Date(now + 86400000));
  if (target.day === tomorrow.day && target.month === tomorrow.month) return `amanhã às ${time}`;
  return date.toLocaleString('pt-PT', { timeZone: LISBON, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function derive(bank: BankInfo | null, now: number) {
  const scheduledAfter = bank?.nextRefreshAt && Date.parse(bank.nextRefreshAt) > now ? new Date(bank.nextRefreshAt) : new Date(now);
  return {
    nextAutomatic: nextAutomaticSync(scheduledAfter),
    limited: !!bank?.manualBlockedUntil,
    recentlyTried: !!bank?.lastAttemptAt && now - Date.parse(bank.lastAttemptAt) < 60000,
    failed: !!bank?.lastErrorCode && !bank.rateLimited,
    expiresInDays: bank?.validUntil ? Math.floor((Date.parse(bank.validUntil) - now) / 86400000) : null,
  };
}

/**
 * The bank in one capsule: a status light and how fresh the data is. The
 * details (next automatic read, validity, balance) open in a popover; the
 * refresh button sits right beside it because it is used every day.
 */
export default function BankSyncStatus({
  bank,
  connected,
  canSync,
  syncing,
  onSync,
  onImport,
}: {
  bank: BankInfo | null;
  /** The account is linked (live data or a bank read). */
  connected: boolean;
  /** Whether "Atualizar agora" applies in this mode. */
  canSync: boolean;
  syncing: boolean;
  onSync: () => void;
  onImport: () => void;
}) {
  const now = useNow();
  const { nextAutomatic, limited, recentlyTried, failed } = derive(bank, now);
  const light = syncing ? 'animate-pulse bg-sky-500' : failed || limited ? 'bg-orange-500' : connected && bank?.fetchedAt ? 'bg-emerald-500' : 'bg-zinc-300';
  const syncTitle = limited ? 'O banco limitou as consultas de hoje.' : recentlyTried ? 'Aguarde um minuto entre consultas.' : 'Atualizar agora';

  return (
    <div className="lg-pill flex items-center gap-0.5 rounded-full p-0.5">
      <Popover className="relative">
        <PopoverButton className="flex h-8 items-center gap-2 rounded-full pl-3 pr-2.5 text-[13px] outline-none transition-colors duration-150 hover:bg-zinc-900/[0.04] focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 data-[open]:bg-zinc-900/[0.06]">
          <span className={cx('h-2 w-2 rounded-full', light)} aria-hidden />
          <span className="hidden font-medium text-zinc-900 sm:inline">Montepio</span><span className="sr-only sm:hidden">Montepio</span>
          <span className="hidden text-zinc-500 sm:inline" aria-live="polite">
            {syncing ? 'a ler…' : !connected ? 'por ligar' : bank?.fetchedAt ? relative(bank.fetchedAt, now) : 'por sincronizar'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        </PopoverButton>
        <PopoverPanel
          transition
          anchor={{ to: 'bottom end', gap: 8 }}
          className="lg-float z-50 w-72 origin-top-right rounded-[20px] p-1.5 transition duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center gap-3 px-3 pb-2 pt-2.5">
            <span className={cx('lg-icon flex h-9 w-9 items-center justify-center rounded-full', connected ? 'text-emerald-500' : 'text-zinc-500')} aria-hidden>
              <Landmark className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">Montepio</p>
              <p className="text-[12.5px] text-zinc-500">
                {connected
                  ? `Ligado${bank?.validUntil ? ` até ${formatDay(bank.validUntil.slice(0, 10), true)}` : ''}`
                  : 'Por ligar'}
              </p>
            </div>
          </div>
          {connected && (
            <dl className="mx-1.5 mb-1.5 divide-y divide-zinc-900/[0.07] rounded-[14px] bg-zinc-900/[0.04] px-3 text-[13px]">
              <Detail label="Última leitura">{bank?.fetchedAt ? relative(bank.fetchedAt, now) : '—'}</Detail>
              <Detail label="Próxima automática">{clock(nextAutomatic, now)}</Detail>
              {bank?.balance !== null && bank?.balance !== undefined && <Detail label="Saldo">{formatEur(bank.balance)}</Detail>}
            </dl>
          )}
          <div className="flex flex-col gap-0.5">
            {canSync && (
              <MenuAction icon={<RefreshCw className={cx('h-4 w-4', syncing && 'animate-spin')} />} disabled={syncing || limited || recentlyTried} onClick={onSync} title={syncTitle}>
                Atualizar agora
              </MenuAction>
            )}
            <MenuAction icon={<FileUp className="h-4 w-4" />} onClick={onImport}>Importar extrato</MenuAction>
          </div>
        </PopoverPanel>
      </Popover>
      {canSync && (
        <IconButton label={syncTitle} className="h-8 w-8" disabled={syncing || limited || recentlyTried} onClick={onSync}>
          <RefreshCw className={cx('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden />
        </IconButton>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums text-zinc-900">{children}</dd>
    </div>
  );
}

function MenuAction({ icon, children, onClick, disabled, title }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium text-zinc-900 outline-none transition-colors duration-150 hover:bg-zinc-900/[0.05] focus-visible:bg-zinc-900/[0.05] disabled:text-zinc-400 disabled:hover:bg-transparent"
    >
      <span className="text-zinc-500" aria-hidden>{icon}</span>
      {children}
    </button>
  );
}

/** Only speaks up when the bank needs attention; one line each. */
export function BankAlerts({ bank, onImport }: { bank: BankInfo | null; onImport: () => void }) {
  const now = useNow();
  const { limited, failed, expiresInDays } = derive(bank, now);
  const alerts: { key: string; icon: ReactNode; text: string; action?: ReactNode }[] = [];
  if (limited && bank?.manualBlockedUntil) {
    alerts.push({
      key: 'limited',
      icon: <TriangleAlert className="h-4 w-4" />,
      text: `O Montepio limitou as consultas de hoje. Próxima tentativa ${clock(new Date(bank.manualBlockedUntil), now)}.`,
      action: <Button size="sm" onClick={onImport}><FileUp className="h-3.5 w-3.5" aria-hidden />Importar extrato</Button>,
    });
  }
  if (failed && !limited) {
    alerts.push({ key: 'failed', icon: <TriangleAlert className="h-4 w-4" />, text: 'A última leitura do banco falhou. Volta a tentar sozinha dentro de 1 hora.' });
  }
  if (expiresInDays !== null && expiresInDays <= 14) {
    alerts.push({
      key: 'expiry',
      icon: <CalendarClock className="h-4 w-4" />,
      text: expiresInDays < 0
        ? 'A autorização do Montepio expirou. Os movimentos novos só entram depois de a renovar.'
        : `A autorização do Montepio expira dentro de ${expiresInDays} ${expiresInDays === 1 ? 'dia' : 'dias'}. Renove-a para não interromper a sincronização.`,
    });
  }
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {alerts.map(alert => (
        <div key={alert.key} className="lg-glass flex flex-col gap-2 rounded-2xl px-4 py-2.5 text-[13px] text-zinc-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5">
            <span className="shrink-0 text-orange-500" aria-hidden>{alert.icon}</span>
            {alert.text}
          </p>
          {alert.action}
        </div>
      ))}
    </div>
  );
}
