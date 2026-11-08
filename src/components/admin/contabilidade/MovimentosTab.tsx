"use client";

import { useMemo, useState } from 'react';
import { Check, Search, TriangleAlert } from 'lucide-react';

import { formatEur, sumAmounts } from '../../../lib/ledger/format';
import MovementRow from './MovementRow';
import { CategoryBreakdown } from './Overview';
import type { LedgerMovement } from './types';
import { Card, EmptyState, cx, isOpen, missingDocument, missingInvoice } from './ui';

type Filter = 'all' | 'in' | 'out' | 'open' | 'no_invoice' | 'no_document';

const FILTERS: { key: Filter; label: string; test: (m: LedgerMovement) => boolean }[] = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'in', label: 'Entradas', test: m => m.amount > 0 },
  { key: 'out', label: 'Saídas', test: m => m.amount < 0 },
  { key: 'open', label: 'Por tratar', test: isOpen },
  { key: 'no_invoice', label: 'Sem FR ligada', test: missingInvoice },
  { key: 'no_document', label: 'Falta documento', test: missingDocument },
];

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dayHeading(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d} de ${MONTHS[m - 1]} · ${weekday}`;
}

/** Opening balance = first balance minus its own movement. */
/**
 * Statement files carry a balance on every line; the bank feed does not, so the
 * month then uses the balance worked back from the bank's own figure.
 */
export function monthBalances(movements: LedgerMovement[], fromBank?: { opening: number; closing: number } | null) {
  const withBalance = movements.filter(movement => movement.balanceAfter !== null);
  const income = sumAmounts(movements.filter(m => m.amount > 0).map(m => m.amount));
  const expenses = sumAmounts(movements.filter(m => m.amount < 0).map(m => m.amount));
  if (withBalance.length === 0) {
    if (!fromBank) return null;
    const computed = sumAmounts([fromBank.opening, income, expenses]);
    return { opening: fromBank.opening, income, expenses, closing: fromBank.closing, matches: Math.abs(computed - fromBank.closing) < 0.005, computed };
  }
  const first = withBalance[0];
  const last = withBalance[withBalance.length - 1];
  const opening = sumAmounts([first.balanceAfter as number, -first.amount]);
  const computed = sumAmounts([opening, income, expenses]);
  const closing = last.balanceAfter as number;
  return { opening, income, expenses, closing, matches: Math.abs(computed - closing) < 0.005, computed };
}

export default function MovimentosTab({
  movements,
  selectedId,
  onOpen,
  monthBalance,
}: {
  movements: LedgerMovement[];
  selectedId: string | null;
  onOpen: (movement: LedgerMovement) => void;
  monthBalance?: { opening: number; closing: number } | null;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(f => [f.key, movements.filter(f.test).length])) as Record<Filter, number>,
    [movements],
  );

  const days = useMemo(() => {
    const test = FILTERS.find(f => f.key === filter)!.test;
    const needle = query.trim().toLowerCase();
    const visible = movements.filter(m => test(m)
      && (!needle || `${m.description} ${m.counterpartyName || ''}`.toLowerCase().includes(needle)));
    const groups = new Map<string, LedgerMovement[]>();
    visible.forEach(m => groups.set(m.bookingDate, [...(groups.get(m.bookingDate) || []), m]));
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [movements, filter, query]);

  const balances = useMemo(() => monthBalances(movements, monthBalance), [movements, monthBalance]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar movimentos">
          {FILTERS.map(item => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.key)}
                className={cx(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out active:scale-95 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
                  active ? 'lg-thumb text-zinc-950' : 'lg-pill text-zinc-500 hover:text-zinc-900',
                  !active && counts[item.key] === 0 && 'opacity-50',
                )}
              >
                {item.label}
                <span className={cx('tabular-nums', active ? 'text-zinc-600' : 'text-zinc-400')}>{counts[item.key]}</span>
              </button>
            );
          })}
        </div>
        <label className="relative w-full lg:w-64">
          <span className="sr-only">Procurar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Procurar"
            className="lg-pill h-9 w-full rounded-full pl-9 pr-3 text-[13.5px] text-zinc-900 transition-shadow duration-150 placeholder:text-zinc-400 focus:shadow-[0_0_0_4px_rgb(9_9_11/0.06)] focus:outline-none"
          />
        </label>
      </div>

      {balances && (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5 text-[13px] tabular-nums">
          <Figure label="Inicial" value={formatEur(balances.opening)} />
          <Op>+</Op>
          <Figure label="Entradas" value={formatEur(balances.income)} tone="text-emerald-600" />
          <Op>−</Op>
          <Figure label="Saídas" value={formatEur(Math.abs(balances.expenses))} />
          <Op>=</Op>
          <Figure label="Final" value={formatEur(balances.closing)} />
          <span className="ml-auto">
            {balances.matches ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-[12.5px] font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Confere com o banco
              </span>
            ) : (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-rose-500/10 px-3 text-[12.5px] font-medium text-rose-700">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Não confere · as contas dão {formatEur(balances.computed)}
              </span>
            )}
          </span>
        </Card>
      )}

      {days.length === 0 ? (
        <Card><EmptyState title="Nada para mostrar">Nenhum movimento com este filtro.</EmptyState></Card>
      ) : (
        <div className="flex flex-col gap-5">
          {days.map(([day, rows]) => {
            const net = sumAmounts(rows.map(r => r.amount));
            return (
              <section key={day}>
                <div className="mb-1.5 flex items-baseline justify-between px-1 text-[12.5px]">
                  <span className="font-semibold text-zinc-700 first-letter:uppercase">{dayHeading(day)}</span>
                  <span className={cx('tabular-nums', net > 0 ? 'text-emerald-600' : 'text-zinc-400')}>{formatEur(net, { signed: true })}</span>
                </div>
                <Card className="overflow-hidden">
                  {rows.map(m => (
                    <div key={m.id} className="group/item">
                      <MovementRow movement={m} onOpen={onOpen} active={m.id === selectedId} showDate={false} />
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      {movements.length > 0 && <CategoryBreakdown movements={movements} />}
    </div>
  );
}

function Figure({ label, value, tone = 'text-zinc-900' }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[11.5px] text-zinc-400">{label}</span>
      <span className={cx('text-[14px] font-semibold tracking-[-0.01em]', tone)}>{value}</span>
    </span>
  );
}

function Op({ children }: { children: string }) {
  return <span className="text-[15px] text-zinc-300" aria-hidden>{children}</span>;
}
