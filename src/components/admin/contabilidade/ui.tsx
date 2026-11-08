"use client";

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, Info } from 'lucide-react';

import { categoryLabel, requiresInvoice, KIND_LABELS } from '../../../lib/ledger/categories';
import { formatEur } from '../../../lib/ledger/format';
import { STATE_PILL, visualFor, type RowState } from './theme';
import type { LedgerMovement } from './types';

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

/*
 * Design tokens of the Contabilidade module (dark, liquid glass — see ledger.css).
 * One neutral ink for everything; emerald only for money in and "done",
 * orange only for "needs you". Containers are sheets of glass, never boxes.
 */
export const SURFACE = 'lg-glass';
/** Critically damped: settles fast, never wobbles. */
export const SPRING = { type: 'spring', stiffness: 460, damping: 42, mass: 0.9 } as const;

// ---------------------------------------------------------------------------
// Surfaces and buttons
// ---------------------------------------------------------------------------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[22px]', SURFACE, className)}>{children}</section>;
}

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-900/25',
  dark: 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-900/25',
  secondary: 'bg-zinc-900/[0.055] text-zinc-900 hover:bg-zinc-900/[0.09] disabled:bg-zinc-900/[0.03] disabled:text-zinc-400',
  ghost: 'text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 disabled:text-zinc-300 disabled:hover:bg-transparent',
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
        'inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-full font-medium tracking-[-0.005em] outline-none',
        'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
        'focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' && 'h-9 px-4 text-[13.5px]',
        size === 'md' && 'h-9 px-4 text-sm',
        size === 'lg' && 'h-11 px-5 text-[15px]',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Small round icon-only button (toolbar). */
export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 outline-none transition-[background-color,color,transform] duration-150 ease-out',
        'hover:bg-zinc-900/[0.06] hover:text-zinc-900 active:scale-90 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
        'disabled:text-zinc-300 disabled:hover:bg-transparent disabled:active:scale-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Explanations live here, one hover away, instead of on the page. */
export function Hint({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <span className="group/hint relative inline-flex">
      <button type="button" className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-300 outline-none transition-colors duration-150 hover:text-zinc-500 focus-visible:text-zinc-600" aria-label="Ajuda">
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className={cx(
          'lg-float pointer-events-none absolute top-full z-40 mt-2 w-72 rounded-2xl px-3.5 py-3 text-[12.5px] font-normal leading-relaxed tracking-normal text-zinc-700 opacity-0',
          'translate-y-1 scale-[0.98] transition-[opacity,transform] duration-150 ease-out',
          'group-hover/hint:translate-y-0 group-hover/hint:scale-100 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:scale-100 group-focus-within/hint:opacity-100',
          align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right',
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** Count capsule, used in tabs and section headers. */
export function Count({ value, tone = 'neutral' }: { value: number; tone?: 'neutral' | 'attention' }) {
  return (
    <span className={cx(
      'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums',
      tone === 'attention' ? 'bg-orange-500 text-white' : 'bg-zinc-900/[0.07] text-zinc-600',
    )}>
      {value}
    </span>
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
        'flex shrink-0 items-center justify-center',
        tone.soft,
        'rounded-full',
        size === 'sm' && 'h-7 w-7',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
        dashed && 'opacity-60',
      )}
      aria-hidden
    >
      <Icon className={cx(tone.ink, size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} strokeWidth={1.75} />
    </span>
  );
}

export function CategoryPill({ code, tentative = false }: { code: string | null | undefined; tentative?: boolean }) {
  if (!code) return <span className="text-[13px] text-zinc-400">Sem categoria</span>;
  return (
    <span
      className={cx('block max-w-full truncate text-[13.5px]', tentative ? 'text-zinc-400 italic' : 'text-zinc-500')}
      title={tentative ? 'Sugestão do sistema — por confirmar' : undefined}
    >
      {categoryLabel(code)}{tentative ? '?' : ''}
    </span>
  );
}

export function rowState(movement: LedgerMovement): { state: RowState; label: string } {
  if (movement.status === 'ignored') return { state: 'ignored', label: 'Ignorado' };
  const items = missingItems(movement);
  if (items.length === 0) return { state: 'complete', label: 'Completo' };
  if (items.includes('fatura')) return { state: 'missing', label: 'Sem FR ligada' };
  if (items.includes('documento')) return { state: 'missing', label: 'Falta documento' };
  if (items.includes('categoria')) return { state: 'missing', label: 'Sem categoria' };
  return { state: 'confirm', label: 'Por confirmar' };
}

export const BADGE = 'inline-flex h-7 max-w-full items-center gap-1 truncate whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium';

export function StatePill({ movement }: { movement: LedgerMovement }) {
  const { state, label } = rowState(movement);
  if (state === 'complete') {
    return (
      <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-emerald-600">
        <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
        {label}
      </span>
    );
  }
  return <span className={cx(BADGE, STATE_PILL[state])}>{label}</span>;
}

export function Amount({ value, className }: { value: number | null; className?: string }) {
  return (
    <span className={cx('whitespace-nowrap font-semibold tracking-[-0.01em] tabular-nums', value !== null && value > 0 ? 'text-emerald-600' : 'text-zinc-900', className)}>
      {formatEur(value, { signed: true })}
    </span>
  );
}

export function Delta({ current, previous, invert = false }: { current: number; previous: number | null; invert?: boolean }) {
  if (previous === null || previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const good = invert ? change <= 0 : change >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums text-zinc-400" title="Face ao mês anterior">
      <span className={good ? 'text-emerald-500' : 'text-rose-500'} aria-hidden>{change >= 0 ? '↑' : '↓'}</span>
      {Math.abs(change).toFixed(0)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4">{icon}</div> : null}
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-sm text-[13px] text-zinc-500">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
      <span className="flex items-center gap-2.5 text-zinc-700">
        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
        {message}
      </span>
      {onRetry ? <Button size="sm" onClick={onRetry}>Tentar de novo</Button> : null}
    </Card>
  );
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <Card className="grid gap-6 p-6 lg:grid-cols-3">
        {[0, 1, 2].map(index => (
          <div key={index} className="space-y-3">
            <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-7 w-40 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-2 w-full animate-pulse rounded-full bg-zinc-100" />
          </div>
        ))}
      </Card>
      <Card className="overflow-hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="h-9 w-9 animate-pulse rounded-[11px] bg-zinc-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-2.5 w-1/5 animate-pulse rounded-full bg-zinc-100/70" />
            </div>
            <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
          </div>
        ))}
      </Card>
    </div>
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
