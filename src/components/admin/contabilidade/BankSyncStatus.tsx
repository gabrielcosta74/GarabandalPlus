"use client";

import { useEffect, useState } from 'react';
import { CalendarClock, FileUp, RefreshCw, TriangleAlert } from 'lucide-react';

import type { BankInfo } from './useLedger';
import { Button, cx } from './ui';

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

export default function BankSyncStatus({
  bank,
  syncing,
  onSync,
  onImport,
}: {
  bank: BankInfo | null;
  syncing: boolean;
  onSync: () => void;
  onImport: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const scheduledAfter = bank?.nextRefreshAt && Date.parse(bank.nextRefreshAt) > now ? new Date(bank.nextRefreshAt) : new Date(now);
  const nextAutomatic = nextAutomaticSync(scheduledAfter);
  const limited = !!bank?.manualBlockedUntil;
  const recentlyTried = !!bank?.lastAttemptAt && now - Date.parse(bank.lastAttemptAt) < 60000;
  const failed = !!bank?.lastErrorCode && !bank.rateLimited;
  const expiresInDays = bank?.validUntil ? Math.floor((Date.parse(bank.validUntil) - now) / 86400000) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-sm text-zinc-600" aria-live="polite">
          <span className={cx('h-2 w-2 rounded-full', syncing ? 'animate-pulse bg-sky-500' : failed || limited ? 'bg-orange-500' : bank?.fetchedAt ? 'bg-emerald-500' : 'bg-zinc-300')} aria-hidden />
          {syncing
            ? 'A ler o Montepio…'
            : bank?.fetchedAt
              ? <>Atualizado <span className="font-medium text-zinc-900">{relative(bank.fetchedAt, now)}</span></>
              : 'Ainda sem leitura do banco'}
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">próxima automática {clock(nextAutomatic, now)}</span>
        </span>
        <Button
          size="sm"
          onClick={onSync}
          disabled={syncing || limited || recentlyTried}
          title={limited ? 'O banco limitou as consultas de hoje.' : recentlyTried ? 'Aguarde um minuto entre consultas.' : 'Consultar o Montepio agora'}
        >
          <RefreshCw className={cx('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden />
          Atualizar agora
        </Button>
      </div>

      {limited && bank?.manualBlockedUntil && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-zinc-200 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-zinc-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
            O Montepio limitou as consultas de hoje. Próxima tentativa {clock(new Date(bank.manualBlockedUntil), now)}. Se precisar já, importe o extrato do Montepio Net.
          </p>
          <Button size="sm" onClick={onImport}><FileUp className="h-3.5 w-3.5" aria-hidden />Importar extrato</Button>
        </div>
      )}

      {failed && !limited && (
        <p className="flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
          A última leitura do banco falhou. Volta a tentar sozinha dentro de 1 hora; pode também carregar em «Atualizar agora».
        </p>
      )}

      {expiresInDays !== null && expiresInDays <= 14 && (
        <p className="flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
          {expiresInDays < 0
            ? 'A autorização do Montepio expirou. Os movimentos novos só entram depois de a renovar.'
            : `A autorização do Montepio expira dentro de ${expiresInDays} ${expiresInDays === 1 ? 'dia' : 'dias'}. Renove-a para não interromper a sincronização.`}
        </p>
      )}
    </div>
  );
}
