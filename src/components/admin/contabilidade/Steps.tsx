"use client";

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

import { cx } from './ui';

export type StepState = 'active' | 'done' | 'todo';

/**
 * One step of a short guided flow. Only the active step is open; a finished
 * step folds into one line saying what was chosen, with "Alterar" to reopen
 * it; later steps show only their title, so the admin always sees where they
 * are and what is left.
 */
export function Step({ n, title, state, summary, onEdit, editDisabled, children }: {
  n: number;
  title: string;
  state: StepState;
  summary?: ReactNode;
  onEdit?: () => void;
  editDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className={cx('relative rounded-2xl transition-colors duration-200', state === 'active' ? 'bg-white p-4 ring-1 ring-zinc-200 shadow-sm' : 'px-4 py-3')}>
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            state === 'done' && 'bg-emerald-600 text-white',
            state === 'active' && 'bg-zinc-900 text-white',
            state === 'todo' && 'bg-zinc-900/[0.06] text-zinc-400',
          )}
          aria-hidden
        >
          {state === 'done' ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cx('text-sm font-semibold', state === 'todo' ? 'text-zinc-400' : 'text-zinc-900')}>{title}</p>
            {state === 'done' && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                disabled={editDisabled}
                className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-900/[0.05] hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Alterar
              </button>
            )}
          </div>
          {state === 'done' && summary && <div className="mt-0.5 text-[13px] text-zinc-600">{summary}</div>}
          {state === 'active' && <div className="mt-3 space-y-3">{children}</div>}
        </div>
      </div>
    </li>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-1.5">{children}</ol>;
}

/** A large, clickable choice: the whole card is the target, the state is visible. */
export function ChoiceCard({ selected, disabled, onSelect, children, tone = 'neutral' }: {
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
  tone?: 'neutral' | 'attention';
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        'flex w-full cursor-pointer items-start gap-3 rounded-xl p-3 text-left text-sm outline-none ring-1 transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.99]',
        'focus-visible:ring-2 focus-visible:ring-zinc-900/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        selected ? 'bg-emerald-50/70 ring-emerald-500' : tone === 'attention' ? 'bg-orange-50/40 ring-orange-200 hover:ring-orange-300' : 'bg-white ring-zinc-200 hover:ring-zinc-400',
      )}
    >
      <span
        className={cx('mt-0.5 h-4 w-4 shrink-0 rounded-full ring-1', selected ? 'bg-emerald-600 ring-emerald-600 shadow-[inset_0_0_0_3px_white]' : 'bg-white ring-zinc-300')}
        aria-hidden
      />
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'info' | 'attention'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone === 'neutral' && 'bg-zinc-100 text-zinc-600',
        tone === 'good' && 'bg-emerald-50 text-emerald-700',
        tone === 'info' && 'bg-sky-50 text-sky-700',
        tone === 'attention' && 'bg-orange-50 text-orange-700',
      )}
    >
      {children}
    </span>
  );
}
