"use client";

import { useMemo, useState } from 'react';
import { Check, Search, TriangleAlert } from 'lucide-react';

import { formatEur, sumAmounts } from '../../../lib/ledger/format';
import MovementRow from './MovementRow';
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
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar movimentos">
          {FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cx(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium outline-none transition-all duration-200 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                filter === item.key ? 'bg-zinc-900 text-white shadow-sm' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 hover:ring-zinc-300',
              )}
            >
              {item.label}
              <span className={cx('tabular-nums', filter === item.key ? 'text-white/60' : 'text-zinc-400')}>{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full 2xl:w-72">
          <span className="sr-only">Procurar</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Procurar pessoa ou descrição"
            className="h-10 w-full rounded-xl bg-white pl-10 pr-3 text-sm text-zinc-900 ring-1 ring-zinc-200 transition-shadow duration-200 placeholder:text-zinc-400 hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </label>
      </div>

      <Card className="overflow-hidden">
        {days.length === 0 ? (
          <EmptyState title="Nada para mostrar">Nenhum movimento com este filtro.</EmptyState>
        ) : (
          days.map(([day, rows]) => {
            const net = sumAmounts(rows.map(r => r.amount));
            return (
              <div key={day}>
                <div className="flex items-center justify-between bg-zinc-50/80 px-5 py-2 text-xs font-medium text-zinc-500">
                  <span className="first-letter:uppercase">{dayHeading(day)}</span>
                  <span className="tabular-nums">{formatEur(net, { signed: true })}</span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {rows.map(m => (
                    <MovementRow key={m.id} movement={m} onOpen={onOpen} active={m.id === selectedId} showDate={false} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {balances && (
        <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-sm tabular-nums">
          <Figure label="Saldo inicial" value={formatEur(balances.opening)} />
          <Op>+</Op>
          <Figure label="Entradas" value={formatEur(balances.income)} tone="text-emerald-600" />
          <Op>−</Op>
          <Figure label="Saídas" value={formatEur(Math.abs(balances.expenses))} />
          <Op>=</Op>
          <Figure label="Saldo final" value={formatEur(balances.closing)} />
          <span className="ml-auto">
            {balances.matches ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Confere com o banco
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Não confere · as contas dão {formatEur(balances.computed)}
              </span>
            )}
          </span>
        </Card>
      )}
    </div>
  );
}

function Figure({ label, value, tone = 'text-zinc-900' }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={cx('font-semibold', tone)}>{value}</span>
    </span>
  );
}

function Op({ children }: { children: string }) {
  return <span className="text-lg text-zinc-300">{children}</span>;
}
