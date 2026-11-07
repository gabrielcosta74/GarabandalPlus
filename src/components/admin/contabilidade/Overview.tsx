"use client";

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ListChecks, Wallet, type LucideIcon } from 'lucide-react';

import { formatEur, sumAmounts } from '../../../lib/ledger/format';
import { visualFor } from './theme';
import type { LedgerMovement } from './types';
import { Card, cx, effectiveCategory, isOpen } from './ui';

type Slice = { key: string; label: string; amount: number; color: string; code: string | null };

/** Groups movements by the category group shown in the charts (Doações, Quotas…). */
function slices(movements: LedgerMovement[], sign: 1 | -1): Slice[] {
  const map = new Map<string, Slice>();
  movements
    .filter(m => m.status !== 'ignored' && Math.sign(m.amount) === sign)
    .forEach(m => {
      const code = effectiveCategory(m);
      const visual = visualFor(code);
      const current = map.get(visual.group);
      const amount = Math.abs(m.amount);
      if (current) current.amount = sumAmounts([current.amount, amount]);
      else map.set(visual.group, { key: visual.group, label: visual.group, amount, color: visual.tone.chart, code });
    });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function totals(movements: LedgerMovement[]) {
  const live = movements.filter(m => m.status !== 'ignored');
  const income = sumAmounts(live.filter(m => m.amount > 0).map(m => m.amount));
  const expenses = Math.abs(sumAmounts(live.filter(m => m.amount < 0).map(m => m.amount)));
  const withBalance = movements.filter(m => m.balanceAfter !== null);
  const balance = withBalance.length ? (withBalance[withBalance.length - 1].balanceAfter as number) : null;
  return { income, expenses, balance };
}

export default function Overview({
  movements,
  previous,
  onOpenTodo,
  monthBalance,
}: {
  movements: LedgerMovement[];
  previous: LedgerMovement[] | null;
  onOpenTodo: () => void;
  monthBalance?: { closing: number; current: boolean } | null;
}) {
  const now = useMemo(() => totals(movements), [movements]);
  const balance = now.balance ?? monthBalance?.closing ?? null;
  const before = useMemo(() => (previous && previous.length ? totals(previous) : null), [previous]);
  const open = movements.filter(isOpen).length;
  const treated = movements.length - open;
  const income = useMemo(() => slices(movements, 1), [movements]);
  const expenses = useMemo(() => slices(movements, -1), [movements]);
  const result = sumAmounts([now.income, -now.expenses]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ArrowDownLeft} dot="bg-emerald-500" label="Entradas" value={now.income}>
          <Change current={now.income} previous={before?.income ?? null} />
        </Kpi>
        <Kpi icon={ArrowUpRight} dot="bg-zinc-400" label="Saídas" value={now.expenses}>
          <Change current={now.expenses} previous={before?.expenses ?? null} lowerIsBetter />
        </Kpi>
        <Kpi icon={Wallet} dot="bg-zinc-900" label={monthBalance?.current ? 'Saldo atual no banco' : 'Saldo no fim do mês'} value={balance}>
          <p className="text-[13px] text-zinc-500">
            Resultado do mês{' '}
            <span className={cx('font-medium tabular-nums', result >= 0 ? 'text-emerald-600' : 'text-zinc-900')}>{formatEur(result, { signed: true })}</span>
          </p>
        </Kpi>
        <button
          type="button"
          onClick={onOpenTodo}
          className="group flex flex-col gap-3 rounded-2xl bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none ring-1 ring-zinc-900/[0.06] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-zinc-900/5 focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:translate-y-0"
        >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-500">
                <span className={cx('h-1.5 w-1.5 rounded-full', open ? 'bg-orange-500' : 'bg-emerald-500')} aria-hidden />
                Por tratar
              </span>
              <ListChecks className="h-4 w-4 text-zinc-300 transition-colors duration-200 group-hover:text-zinc-500" aria-hidden />
            </span>
            <span className="text-[28px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums">
              {open}
              <span className="ml-1.5 text-base font-medium text-zinc-400">de {movements.length}</span>
            </span>
            <Segments done={treated} total={movements.length} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown title="De onde veio o dinheiro" total={now.income} items={income} empty="Sem entradas neste mês." />
        <Breakdown title="Para onde foi" total={now.expenses} items={expenses} empty="Sem saídas neste mês." />
      </div>
    </div>
  );
}

/** "6.633" big, ",20 €" quieter — easier to read at a glance. */
function Money({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-300">—</span>;
  const text = formatEur(value);
  const comma = text.lastIndexOf(',');
  return (
    <>
      {text.slice(0, comma)}
      <span className="text-lg font-medium text-zinc-400">{text.slice(comma)}</span>
    </>
  );
}

function Kpi({ icon: Icon, dot, label, value, children }: { icon: LucideIcon; dot: string; label: string; value: number | null; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-500">
          <span className={cx('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
          {label}
        </span>
        <Icon className="h-4 w-4 text-zinc-300" aria-hidden />
      </div>
      <p className="text-[28px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums">
        <Money value={value} />
      </p>
      {children}
    </Card>
  );
}

function Change({ current, previous, lowerIsBetter = false }: { current: number; previous: number | null; lowerIsBetter?: boolean }) {
  if (previous === null || previous === 0) return <p className="text-[13px] text-zinc-400">Sem dados do mês anterior</p>;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const good = lowerIsBetter ? change <= 0 : change >= 0;
  return (
    <p className="text-[13px] text-zinc-500">
      <span className={cx('font-medium tabular-nums', good ? 'text-emerald-600' : 'text-rose-500')}>
        {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(0)}%
      </span>{' '}
      face ao mês anterior
    </p>
  );
}

function Segments({ done, total }: { done: number; total: number }) {
  const count = Math.min(total, 24);
  const filled = total ? Math.round((done / total) * count) : 0;
  return (
    <span className="flex w-full items-center gap-[3px]" aria-label={`${done} de ${total} tratados`}>
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className={cx('h-1.5 flex-1 rounded-full transition-colors duration-500', index < filled ? 'bg-emerald-500' : 'bg-zinc-100')}
          style={{ transitionDelay: `${index * 15}ms` }}
        />
      ))}
    </span>
  );
}

function Breakdown({ title, total, items, empty }: { title: string; total: number; items: Slice[]; empty: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = items.find(item => item.key === hovered) || null;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
        <span className="text-[13px] tabular-nums text-zinc-500">{items.length} {items.length === 1 ? 'origem' : 'origens'}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">{empty}</p>
      ) : (
        <div className="mt-4 flex items-center gap-6">
          <div className="relative shrink-0">
            <Donut items={items} total={total} hovered={hovered} onHover={setHovered} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-zinc-400">{focus ? focus.label : 'Total'}</span>
              <span className="text-sm font-semibold tabular-nums text-zinc-900">{formatEur(focus ? focus.amount : total)}</span>
            </div>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col" onMouseLeave={() => setHovered(null)}>
            {items.slice(0, 5).map(item => {
              const { icon: Icon, tone } = visualFor(item.code);
              const share = total ? Math.round((item.amount / total) * 100) : 0;
              const dimmed = hovered !== null && hovered !== item.key;
              return (
                <li
                  key={item.key}
                  onMouseEnter={() => setHovered(item.key)}
                  className={cx(
                    '-mx-2 flex cursor-default items-center gap-3 rounded-xl px-2 py-1.5 transition-all duration-200 ease-out',
                    hovered === item.key && 'bg-zinc-50',
                    dimmed && 'opacity-50',
                  )}
                >
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', tone.soft)} aria-hidden>
                    <Icon className={cx('h-3.5 w-3.5', tone.ink)} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{item.label}</span>
                  <span className="text-sm font-medium tabular-nums text-zinc-900">{formatEur(item.amount)}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-zinc-400">{share}%</span>
                </li>
              );
            })}
            {items.length > 5 && <li className="px-2 pt-1 text-xs text-zinc-400">+ {items.length - 5} outras</li>}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Donut({ items, total, hovered, onHover }: { items: Slice[]; total: number; hovered: string | null; onHover: (key: string | null) => void }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const gap = items.length > 1 ? 2.5 : 0;
  let offset = 0;
  return (
    <svg viewBox="0 0 112 112" className="h-32 w-32 -rotate-90" role="img" aria-label="Distribuição por origem" onMouseLeave={() => onHover(null)}>
      <circle cx="56" cy="56" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="11" />
      {items.map(item => {
        const length = total ? (item.amount / total) * circumference : 0;
        const dash = Math.max(length - gap, 0.001);
        const active = hovered === item.key;
        const element = (
          <circle
            key={item.key}
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={active ? 14 : 11}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            opacity={hovered && !active ? 0.25 : 1}
            onMouseEnter={() => onHover(item.key)}
            style={{ transition: 'opacity 200ms ease-out, stroke-width 200ms ease-out', cursor: 'default' }}
          />
        );
        offset += length;
        return element;
      })}
    </svg>
  );
}
