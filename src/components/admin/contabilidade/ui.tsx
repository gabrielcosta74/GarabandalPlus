"use client";

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

import { categoryLabel, requiresInvoice, KIND_LABELS } from '../../../lib/ledger/categories';
import { formatEur } from '../../../lib/ledger/format';
import { STATE_PILL, visualFor, type RowState } from './theme';
import type { LedgerMovement } from './types';

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Surfaces and buttons
// ---------------------------------------------------------------------------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl bg-white ring-1 ring-zinc-900/[0.06] shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      {children}
    </section>
  );
}

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-600/20 disabled:bg-emerald-600/40 disabled:shadow-none',
  dark: 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 hover:shadow-md disabled:bg-zinc-900/30 disabled:shadow-none',
  secondary: 'bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300 hover:shadow-sm disabled:bg-white disabled:text-zinc-400 disabled:shadow-none',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-11 px-5 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Category, state and amount
// ---------------------------------------------------------------------------

export function IconTile({ code, size = 'md', dashed = false }: { code: string | null | undefined; size?: 'sm' | 'md' | 'lg'; dashed?: boolean }) {
  const { icon: Icon, tone } = visualFor(code);
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ease-out group-hover:scale-105',
        tone.soft,
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12 rounded-2xl',
        dashed && 'outline-1 outline-dashed outline-zinc-300',
      )}
      aria-hidden
    >
      <Icon className={cx(tone.ink, size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]')} strokeWidth={2} />
    </span>
  );
}

export function CategoryPill({ code, tentative = false }: { code: string | null | undefined; tentative?: boolean }) {
  if (!code) return <span className="text-[13px] text-zinc-400">Sem categoria</span>;
  const { tone } = visualFor(code);
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs font-medium',
        tentative ? 'bg-white text-zinc-500 outline-1 -outline-offset-1 outline-dashed outline-zinc-300' : cx(tone.soft, tone.ink),
      )}
      title={tentative ? 'Sugestão do sistema — por confirmar' : undefined}
    >
      {categoryLabel(code)}
      {tentative ? '?' : ''}
    </span>
  );
}

export function rowState(movement: LedgerMovement): { state: RowState; label: string } {
  if (movement.status === 'ignored') return { state: 'ignored', label: 'Ignorado' };
  const items = missingItems(movement);
  if (items.length === 0) return { state: 'complete', label: 'Completo' };
  if (items.includes('fatura')) return { state: 'missing', label: 'Falta fatura' };
  if (items.includes('documento')) return { state: 'missing', label: 'Falta documento' };
  if (items.includes('categoria')) return { state: 'missing', label: 'Sem categoria' };
  return { state: 'confirm', label: 'Por confirmar' };
}

export function StatePill({ movement }: { movement: LedgerMovement }) {
  const { state, label } = rowState(movement);
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', STATE_PILL[state])}>
      {state === 'complete' && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
      {label}
    </span>
  );
}

export function Amount({ value, className }: { value: number | null; className?: string }) {
  return (
    <span className={cx('whitespace-nowrap font-semibold tabular-nums', value !== null && value > 0 ? 'text-emerald-600' : 'text-zinc-900', className)}>
      {formatEur(value, { signed: true })}
    </span>
  );
}

export function Delta({ current, previous, invert = false }: { current: number; previous: number | null; invert?: boolean }) {
  if (previous === null || previous === 0) return <span className="text-xs text-zinc-400">sem mês anterior</span>;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const good = invert ? change <= 0 : change >= 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <span className={cx('rounded-md px-1.5 py-0.5 font-semibold tabular-nums', good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
        {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(0)}%
      </span>
      vs mês anterior
    </span>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon ? <div className="mb-4">{icon}</div> : null}
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-500">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
      <span className="text-zinc-700">{message}</span>
      {onRetry ? <Button size="sm" onClick={onRetry}>Tentar de novo</Button> : null}
    </Card>
  );
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="divide-y divide-zinc-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-zinc-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-3 w-1/5 animate-pulse rounded-full bg-zinc-100" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
        </div>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Movement helpers
// ---------------------------------------------------------------------------

/** First line for a movement: the person, else the kind of movement. */
export function movementTitle(movement: Pick<LedgerMovement, 'counterpartyName' | 'description' | 'kind'>): string {
  if (movement.counterpartyName) return movement.counterpartyName;
  return movement.kind !== 'other' ? KIND_LABELS[movement.kind] : movement.description;
}

export function isOpen(movement: LedgerMovement): boolean {
  return movement.status === 'unreviewed' || movement.status === 'suggested';
}

export function effectiveCategory(movement: LedgerMovement): string | null {
  return movement.categoryCode || movement.suggestedCategoryCode || null;
}

export function missingDocument(movement: LedgerMovement): boolean {
  return movement.amount < 0 && movement.needsDocument && movement.documentCount === 0 && !movement.paperDocument;
}

export function missingInvoice(movement: LedgerMovement): boolean {
  return movement.amount > 0 && requiresInvoice(effectiveCategory(movement)) && movement.invoiceRefs.length === 0;
}

/** What still has to be done for a movement to be complete, in plain words. */
export function missingItems(movement: LedgerMovement): string[] {
  if (movement.status === 'ignored') return [];
  const items: string[] = [];
  if (!movement.categoryCode) items.push(movement.suggestedCategoryCode ? 'confirmar' : 'categoria');
  if (missingInvoice(movement)) items.push('fatura');
  if (missingDocument(movement)) items.push('documento');
  if (items.length === 0 && isOpen(movement)) items.push('confirmar');
  return items;
}
