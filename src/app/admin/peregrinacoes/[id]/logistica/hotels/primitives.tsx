"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 } as const;

export function cx(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(' ');
}

const EUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const EUR0 = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const eur = (value: number) => EUR.format(value);
export const eur0 = (value: number) => EUR0.format(value);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function day(iso: string | null | undefined, withYear = false) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}
export function range(a: string, b: string) {
    const [, am] = a.split('-').map(Number);
    const [, bm] = b.split('-').map(Number);
    return am === bm ? `${Number(a.slice(8))} → ${day(b)}` : `${day(a)} → ${day(b)}`;
}

export type Tone = 'neutral' | 'ok' | 'soon' | 'late' | 'info';
const TONES: Record<Tone, string> = {
    neutral: 'bg-zinc-900/[0.05] text-zinc-600',
    ok: 'bg-emerald-500/10 text-emerald-700',
    soon: 'bg-amber-500/12 text-amber-700',
    late: 'bg-rose-500/10 text-rose-700',
    info: 'bg-sky-500/10 text-sky-700',
};
const DOTS: Record<Tone, string> = {
    neutral: 'bg-zinc-400', ok: 'bg-emerald-500', soon: 'bg-amber-500', late: 'bg-rose-500', info: 'bg-sky-500',
};

export function Chip({ tone = 'neutral', children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
    return (
        <span className={cx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium', TONES[tone], className)}>
            {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
            {children}
        </span>
    );
}

/** Anel do pago, com o número no centro. */
export function Ring({ share, size = 44, tone = 'neutral' }: { share: number; size?: number; tone?: Tone }) {
    const reduce = useReducedMotion();
    const stroke = 4;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const color = tone === 'late' ? '#e11d48' : tone === 'soon' ? '#d97706' : share >= 0.999 ? '#059669' : '#18181b';
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(9 9 11 / 0.08)" strokeWidth={stroke} />
            <motion.circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, share))) }}
                transition={reduce ? { duration: 0 } : { ...SPRING, stiffness: 120, damping: 24 }}
            />
        </svg>
    );
}

export function Button({
    children, onClick, variant = 'secondary', disabled, className, type = 'button', title,
}: {
    children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    disabled?: boolean; className?: string; type?: 'button' | 'submit'; title?: string;
}) {
    const styles = {
        primary: 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-900/25',
        secondary: 'hg-pill text-zinc-800 hover:bg-white disabled:text-zinc-400',
        ghost: 'text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 disabled:text-zinc-300',
        danger: 'text-rose-600 hover:bg-rose-500/10 disabled:text-rose-300',
    }[variant];
    return (
        <motion.button
            type={type}
            title={title}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={SPRING}
            onClick={onClick}
            disabled={disabled}
            className={cx('inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium transition-colors duration-150 disabled:cursor-not-allowed', styles, className)}
        >
            {children}
        </motion.button>
    );
}

/** Controlo segmentado com o "polegar" de vidro a deslizar. */
export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: {
    value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void; size?: 'sm' | 'md';
}) {
    const id = useId();
    return (
        <div className="hg-well inline-flex rounded-full p-1" role="tablist">
            {options.map(option => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(option.value)}
                        className={cx('relative rounded-full font-medium transition-colors duration-150',
                            size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-8 px-3.5 text-[13.5px]',
                            active ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800')}
                    >
                        {active && <motion.span layoutId={`seg-${id}`} transition={SPRING} className="hg-thumb absolute inset-0 rounded-full" />}
                        <span className="relative">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** Campo que grava ao sair (Enter também). Esc repõe. */
export function InlineInput({
    value, onCommit, placeholder, kind = 'text', className, align = 'left', suffix, ariaLabel, disabled,
}: {
    value: string | number | null; onCommit: (value: string) => void; placeholder?: string;
    kind?: 'text' | 'number' | 'date' | 'email' | 'tel'; className?: string; align?: 'left' | 'right';
    suffix?: string; ariaLabel?: string; disabled?: boolean;
}) {
    const shown = value === null || value === undefined ? '' : kind === 'number' ? String(value).replace('.', ',') : String(value);
    const [draft, setDraft] = useState(shown);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { if (document.activeElement !== ref.current) setDraft(shown); }, [shown]);
    const commit = () => { if (draft !== shown) onCommit(draft); };
    return (
        <span className={cx('relative inline-flex w-full items-center', className)}>
            <input
                ref={ref}
                type={kind === 'number' ? 'text' : kind}
                inputMode={kind === 'number' ? 'decimal' : undefined}
                value={draft}
                disabled={disabled}
                aria-label={ariaLabel || placeholder}
                placeholder={placeholder}
                onChange={event => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={event => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                    if (event.key === 'Escape') { setDraft(shown); (event.target as HTMLInputElement).blur(); }
                }}
                className={cx('hg-input h-9 w-full px-2.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 disabled:text-zinc-500',
                    align === 'right' && 'text-right tabular-nums', suffix && 'pr-7')}
            />
            {suffix && <span className="pointer-events-none absolute right-2.5 text-[12.5px] text-zinc-400">{suffix}</span>}
        </span>
    );
}

/** Lê "1.234,50" e "1234.50". */
export function parseAmount(text: string): number | null {
    const clean = text.trim();
    if (!clean) return null;
    const value = Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean);
    return Number.isFinite(value) ? value : null;
}

export function Label({ children }: { children: ReactNode }) {
    return <span className="mb-1 block px-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{children}</span>;
}

export function Money({ value, className }: { value: number; className?: string }) {
    return <span className={cx('tabular-nums', className)}>{eur(value)}</span>;
}
