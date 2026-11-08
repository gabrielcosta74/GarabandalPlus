"use client";

import { motion } from 'framer-motion';
import { useMemo } from 'react';

import { formatEur, sumAmounts } from '../../../lib/ledger/format';
import { visualFor } from './theme';
import type { LedgerMovement } from './types';
import { Card, Delta, SPRING, cx, effectiveCategory, isOpen } from './ui';

type Slice = { key: string; label: string; amount: number; code: string | null };

/** Groups movements by the category group (Doações, Quotas…). */
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
      else map.set(visual.group, { key: visual.group, label: visual.group, amount, code });
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

/**
 * The month in four numbers, on one sheet of glass. No charts, no legend:
 * the breakdown by category lives in Movimentos.
 */
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
  const result = sumAmounts([now.income, -now.expenses]);

  return (
    <Card className="relative overflow-hidden">
      {/* A soft highlight across the top edge of the glass. */}
      <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" aria-hidden />
      <div className="grid gap-y-6 p-6 sm:grid-cols-3 sm:p-7 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:items-end">
        <div className="sm:col-span-3 lg:col-span-1">
          <p className="text-[13px] text-zinc-500">{monthBalance?.current ? 'Saldo no banco' : 'Saldo no fim do mês'}</p>
          <p className="mt-2 text-[44px] font-semibold leading-none tracking-[-0.04em] text-zinc-900 tabular-nums">
            <Money value={balance} />
          </p>
          <p className="mt-3 text-[13px] text-zinc-500">
            <span className={cx('font-medium tabular-nums', result >= 0 ? 'text-emerald-600' : 'text-zinc-700')}>{formatEur(result, { signed: true })}</span>
            {' '}este mês
          </p>
        </div>

        <Stat label="Entradas" value={formatEur(now.income)} delta={<Delta current={now.income} previous={before?.income ?? null} />} />
        <Stat label="Saídas" value={formatEur(now.expenses)} delta={<Delta current={now.expenses} previous={before?.expenses ?? null} invert />} />

        <button
          type="button"
          onClick={onOpenTodo}
          className="group -m-2 flex flex-col rounded-2xl p-2 text-left outline-none transition-colors duration-150 hover:bg-zinc-900/[0.04] focus-visible:bg-zinc-900/[0.05] lg:border-l lg:border-zinc-900/[0.07] lg:pl-7"
        >
          <span className="text-[13px] text-zinc-500">Por tratar</span>
          <span className="mt-2 flex items-baseline gap-1.5">
            <span className={cx('text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums', open ? 'text-zinc-900' : 'text-emerald-600')}>{open}</span>
            <span className="text-[13px] tabular-nums text-zinc-400">de {movements.length}</span>
          </span>
          <Track done={treated} total={movements.length} />
        </button>
      </div>
    </Card>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <div className="lg:border-l lg:border-zinc-900/[0.07] lg:pl-7">
      <p className="flex items-center gap-2 text-[13px] text-zinc-500">{label}{delta}</p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-zinc-900 tabular-nums">{value}</p>
      <span className="mt-3 block h-[3px]" aria-hidden />
    </div>
  );
}

/** "6.633" at full weight, ",20 €" quieter. */
function Money({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-300">—</span>;
  const text = formatEur(value);
  const comma = text.lastIndexOf(',');
  return (
    <>
      {text.slice(0, comma)}
      <span className="text-[0.5em] font-medium tracking-[-0.01em] text-zinc-400">{text.slice(comma)}</span>
    </>
  );
}

function Track({ done, total }: { done: number; total: number }) {
  const share = total ? done / total : 0;
  return (
    <span className="mt-3 block h-[3px] w-full overflow-hidden rounded-full bg-zinc-900/[0.08]" aria-label={`${done} de ${total} tratados`}>
      <motion.span
        className="block h-full rounded-full bg-emerald-500"
        initial={false}
        animate={{ width: `${share * 100}%` }}
        transition={SPRING}
      />
    </span>
  );
}

/** Where the money came from and went, in one ink. Lives under Movimentos. */
export function CategoryBreakdown({ movements }: { movements: LedgerMovement[] }) {
  const income = useMemo(() => slices(movements, 1), [movements]);
  const expenses = useMemo(() => slices(movements, -1), [movements]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Breakdown title="De onde veio" items={income} />
      <Breakdown title="Para onde foi" items={expenses} />
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: Slice[] }) {
  const total = sumAmounts(items.map(item => item.amount));
  const top = items[0]?.amount || 0;
  return (
    <section>
      <h3 className="mb-2.5 px-1 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">{title}</h3>
      <Card className="p-2">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-zinc-400">Nada neste mês</p>
        ) : (
          <ul>
            {items.map(item => {
              const { icon: Icon } = visualFor(item.code);
              const share = total ? Math.round((item.amount / total) * 100) : 0;
              return (
                <li key={item.key} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors duration-150 hover:bg-zinc-900/[0.04]">
                  <span className="lg-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full" aria-hidden>
                    <Icon className="h-[14px] w-[14px] text-zinc-700" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13.5px] text-zinc-800">{item.label}</span>
                      <span className="shrink-0 text-[13.5px] font-medium tabular-nums text-zinc-900">{formatEur(item.amount)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="block h-[3px] flex-1 overflow-hidden rounded-full bg-zinc-900/[0.07]">
                        <motion.span
                          className="block h-full rounded-full bg-zinc-800"
                          initial={{ width: 0 }}
                          animate={{ width: `${top ? (item.amount / top) * 100 : 0}%` }}
                          transition={SPRING}
                        />
                      </span>
                      <span className="w-8 text-right text-[11.5px] tabular-nums text-zinc-400">{share}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
