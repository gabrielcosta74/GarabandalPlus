"use client";

import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Download, FileSpreadsheet, LoaderCircle, Lock, LockOpen } from 'lucide-react';

import { formatDay, formatEur, formatPeriod } from '../../../lib/ledger/format';
import { monthBalances } from './MovimentosTab';
import { useToast } from './Toasts';
import type { LedgerMovement } from './types';
import { adminFetch, downloadAdminFile } from './useLedger';
import { Button, Card, EmptyState, Hint, SPRING, cx, isOpen, missingDocument, missingInvoice } from './ui';

type CheckItem = {
  key: string;
  label: string;
  state: 'ok' | 'fail' | 'warn';
  detail: string;
  goTo?: 'por-tratar' | 'movimentos';
};

type CloseState = {
  checks: CheckItem[];
  ready: boolean;
  closed: { closed_by: string; closed_at: string } | null;
  history: { action: 'closed' | 'reopened'; actor: string; reason: string | null; created_at: string }[];
};

/** Example data only: the same questions, answered in the browser. */
function localChecks(movements: LedgerMovement[], monthBalance?: { opening: number; closing: number } | null): CheckItem[] {
  const open = movements.filter(isOpen).length;
  const noInvoice = movements.filter(missingInvoice).length;
  const noDocument = movements.filter(missingDocument).length;
  const balances = monthBalances(movements, monthBalance);
  return [
    { key: 'open', label: 'Todos os movimentos tratados', state: open ? 'fail' : 'ok', detail: open ? `${open} ainda por tratar` : 'Nenhum por tratar', goTo: 'por-tratar' },
    { key: 'invoice', label: 'Entradas com fatura-recibo', state: noInvoice ? 'fail' : 'ok', detail: noInvoice ? `${noInvoice} sem FR` : 'Todas têm FR', goTo: 'movimentos' },
    { key: 'document', label: 'Despesas com documento', state: noDocument ? 'fail' : 'ok', detail: noDocument ? `${noDocument} sem documento` : 'Todas justificadas', goTo: 'por-tratar' },
    { key: 'balance', label: 'Saldo confirmado pelo banco', state: balances?.matches ? 'ok' : 'fail', detail: balances ? `Saldo final ${formatEur(balances.closing)}` : 'Sem saldo' },
  ];
}

export default function FechoTab({
  period,
  movements,
  readOnlyReason,
  closedBy,
  onGo,
  monthBalance,
  live,
  onChanged,
}: {
  period: string | null;
  movements: LedgerMovement[];
  readOnlyReason: string | null;
  closedBy: { closed_by: string; closed_at: string } | null;
  onGo: (tab: 'por-tratar' | 'movimentos') => void;
  monthBalance?: { opening: number; closing: number } | null;
  live: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [server, setServer] = useState<CloseState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'close' | 'reopen' | 'download' | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!live || !period) return;
    setLoadError(null);
    try {
      setServer(await adminFetch(`/api/admin/contabilidade/fecho?period=${period}`));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível verificar o mês.');
    }
  }, [live, period]);

  useEffect(() => {
    setServer(null);
    setConfirmingClose(false);
    setReopening(false);
    setReason('');
    void load();
  }, [load, movements]);

  const checks = useMemo<CheckItem[]>(() => (live ? server?.checks || [] : localChecks(movements, monthBalance)), [live, server, movements, monthBalance]);
  const closed = live ? server?.closed ?? null : closedBy;
  const ready = live ? !!server?.ready : checks.every(check => check.state !== 'fail');

  if (!period || movements.length === 0) {
    return <Card><EmptyState title="Sem movimentos para fechar" /></Card>;
  }

  const blocking = checks.filter(check => check.state !== 'warn');
  const passed = blocking.filter(check => check.state === 'ok').length;

  const act = async (action: 'close' | 'reopen') => {
    setBusy(action);
    try {
      await adminFetch('/api/admin/contabilidade/fecho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'close' ? { period, action } : { period, action, reason }),
      });
      toast(action === 'close'
        ? { title: `${formatPeriod(period)} fechado`, description: 'O Excel para a Factor M ficou guardado.' }
        : { tone: 'info', title: `${formatPeriod(period)} reaberto`, description: 'Pode voltar a alterar este mês.' });
      setConfirmingClose(false);
      setReopening(false);
      setReason('');
      onChanged();
      await load();
    } catch (error) {
      toast({ tone: 'error', title: action === 'close' ? 'Não foi possível fechar' : 'Não foi possível reabrir', description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      await downloadAdminFile(`/api/admin/contabilidade/fecho/excel?period=${period}`, `contabilidade-${period}.xlsx`);
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível descarregar', description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-6">
          <Ring value={passed} total={blocking.length} closed={!!closed} />
          <div className="min-w-0">
            <p className="text-[13px] text-zinc-500">{formatPeriod(period)}</p>
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-zinc-900">
              {closed ? 'Mês fechado' : ready ? 'Pronto a fechar' : 'Por preparar'}
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {closed
                ? `Por ${closed.closed_by} · ${formatDay(closed.closed_at.slice(0, 10), true)}`
                : ready
                  ? 'Tudo justificado.'
                  : `Falta${blocking.length - passed === 1 ? '' : 'm'} ${blocking.length - passed} ${blocking.length - passed === 1 ? 'verificação' : 'verificações'}.`}
            </p>
          </div>
        </div>
        {live && !server && !loadError && <p className="flex items-center gap-2 border-t border-zinc-900/[0.06] px-6 py-4 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A verificar o mês…</p>}
        {loadError && <p className="border-t border-zinc-900/[0.06] px-6 py-4 text-[13px] text-rose-700">{loadError}</p>}
        <ul className="border-t border-zinc-900/[0.06]">
          {checks.map(check => (
            <li key={check.key} className="relative flex items-center gap-3.5 px-6 py-3.5 before:absolute before:left-[62px] before:right-0 before:top-0 before:h-px before:bg-zinc-900/[0.06] first:before:hidden">
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                  check.state === 'ok' && 'bg-emerald-500 text-white',
                  check.state === 'fail' && 'text-transparent ring-[1.5px] ring-inset ring-zinc-300',
                  check.state === 'warn' && 'bg-orange-500/10 text-orange-600',
                )}
                aria-hidden
              >
                {check.state === 'warn' ? '!' : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{check.label}</p>
                <p className={cx('text-[12.5px]', check.state === 'fail' ? 'text-orange-600' : 'text-zinc-400')}>{check.detail}</p>
              </div>
              {check.state === 'fail' && check.goTo && !closed && (
                <Button size="sm" onClick={() => onGo(check.goTo!)}>
                  Resolver <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="flex h-fit flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className={cx('flex h-10 w-10 items-center justify-center rounded-[12px]', closed ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-white')} aria-hidden>
              {closed ? <Lock className="h-[18px] w-[18px]" /> : <FileSpreadsheet className="h-[18px] w-[18px]" />}
            </span>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">{closed ? 'Enviado ao contabilista' : 'Enviar ao contabilista'}</h3>
              <Hint align="right">
                {closed
                  ? 'O Excel guardado no fecho é o que a Factor M recebe. Reabrir só com motivo, que fica registado.'
                  : 'Ao fechar, o mês fica bloqueado e o Excel fica guardado. Pode descarregar um rascunho antes.'}
              </Hint>
            </div>
          </div>

          {!closed && (confirmingClose ? (
            <div className="rounded-2xl bg-zinc-900/[0.04] p-4">
              <p className="text-[13px] text-zinc-700">Depois de fechado, nada de {formatPeriod(period)} pode ser alterado até alguém o reabrir com motivo.</p>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={busy !== null} onClick={() => setConfirmingClose(false)}>Voltar</Button>
                <Button variant="dark" className="flex-1" disabled={busy !== null} onClick={() => void act('close')}>
                  {busy === 'close' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="dark"
              size="lg"
              disabled={!live || !ready || !!readOnlyReason || busy !== null}
              title={!live ? 'Disponível com os movimentos reais.' : !ready ? 'Resolva primeiro as verificações em falta.' : undefined}
              onClick={() => setConfirmingClose(true)}
            >
              <Lock className="h-4 w-4" aria-hidden />
              Fechar mês e gerar Excel
            </Button>
          ))}

          {live && (
            <Button variant="secondary" disabled={busy !== null} onClick={() => void download()}>
              {busy === 'download' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              {closed ? 'Descarregar Excel' : 'Descarregar rascunho'}
            </Button>
          )}

          {closed && live && (reopening ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={reason}
                onChange={event => setReason(event.target.value)}
                rows={2}
                placeholder="Porque é que este mês tem de ser reaberto?"
                className="w-full resize-none rounded-xl bg-zinc-900/[0.04] px-3.5 py-3 text-[13.5px] text-zinc-900 transition placeholder:text-zinc-400 focus:bg-white focus:shadow-[0_0_0_1px_rgba(9,9,11,0.08),0_0_0_4px_rgba(9,9,11,0.05)] focus:outline-none"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={busy !== null} onClick={() => setReopening(false)}>Cancelar</Button>
                <Button variant="secondary" className="flex-1" disabled={busy !== null || reason.trim().length < 5} onClick={() => void act('reopen')}>
                  {busy === 'reopen' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <LockOpen className="h-4 w-4" aria-hidden />}
                  Reabrir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" disabled={busy !== null} onClick={() => setReopening(true)}>
              <LockOpen className="h-4 w-4" aria-hidden /> Reabrir mês
            </Button>
          ))}
        </Card>

        {live && !!server?.history.length && (
          <div className="px-1">
            <h3 className="mb-2 text-[12.5px] font-semibold text-zinc-500">Histórico</h3>
            <ul className="space-y-2.5">
              {server.history.map(event => (
                <li key={`${event.action}-${event.created_at}`} className="flex gap-2.5 text-[12.5px] text-zinc-500">
                  <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', event.action === 'closed' ? 'bg-emerald-500' : 'bg-orange-500')} aria-hidden />
                  <span>
                    <span className="font-medium text-zinc-900">{event.action === 'closed' ? 'Fechado' : 'Reaberto'}</span>{' '}
                    por {event.actor} · {formatDay(event.created_at.slice(0, 10), true)}
                    {event.reason && <span className="block text-zinc-400">«{event.reason}»</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Ring({ value, total, closed }: { value: number; total: number; closed: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const share = total ? value / total : 0;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth="6"
          strokeLinecap="round"
          initial={false}
          animate={{ strokeDasharray: `${share * circumference} ${circumference}` }}
          transition={SPRING}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-zinc-900">
        {closed ? <Lock className="h-4 w-4 text-emerald-600" aria-hidden /> : `${value}/${total}`}
      </span>
    </div>
  );
}
