"use client";

/**
 * Primitivas da área de Logística & Contas.
 *
 * Regra: os ecrãs não escrevem classes de cor do Tailwind. Tudo o que tem cor
 * passa por aqui, para que os seis separadores fiquem iguais entre si e iguais
 * ao resto do painel admin (mesmos tons de `components/admin/ui/tones.ts`).
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, CalendarDays, type LucideIcon } from 'lucide-react';
import { TONE_BADGE, TONE_CHIP, TONE_DOT, type Tone } from '../../../../../../components/admin/ui/tones';

// ---------------------------------------------------------------------------
// Papéis semânticos — o ecrã pede um significado, não uma cor.
// ---------------------------------------------------------------------------

export type Role =
    | 'neutral'   // por decidir, sem dados
    | 'progress'  // em curso
    | 'waiting'   // à espera de ação nossa
    | 'done'      // fechado, pago
    | 'alert'     // problema real
    | 'special';  // cortesia

export const ROLE_TONE: Record<Role, Tone> = {
    neutral: 'slate',
    progress: 'sky',
    waiting: 'amber',
    done: 'emerald',
    alert: 'rose',
    special: 'violet',
};

export const roleBadge = (role: Role) => TONE_BADGE[ROLE_TONE[role]];
export const roleChip = (role: Role) => TONE_CHIP[ROLE_TONE[role]];
export const roleDot = (role: Role) => TONE_DOT[ROLE_TONE[role]];

/**
 * Cor de um valor em dívida.
 *
 * Vermelho é reservado para o prazo já ultrapassado. Sem isto, sete linhas a
 * dizer "falta pagar" ficam todas vermelhas e o alarme deixa de significar algo.
 */
export function dueRole(due: number, dueDate?: string | null): Role {
    if (due <= 0.5) return 'done';
    if (dueDate && new Date(dueDate + 'T23:59:59') < new Date()) return 'alert';
    return 'neutral';
}

export const INK = {
    strong: 'text-slate-900',
    base: 'text-slate-700',
    muted: 'text-slate-500',
    faint: 'text-slate-400',
} as const;

/**
 * Rampa de dados — um só tom, do escuro ao claro.
 *
 * As rubricas de despesa são partes de um mesmo total, não categorias
 * independentes: uma rampa sequencial lê-se melhor do que quatro cores
 * diferentes, e mantém a página com uma paleta só. Ordenar da maior para a
 * menor faz o gradiente coincidir com a grandeza.
 */
export const DATA_BLUE = ['#075985', '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8'] as const;

export const dataBlue = (index: number) => DATA_BLUE[Math.min(index, DATA_BLUE.length - 1)];

/** Cores de resultado. Só duas, e só para o saldo. */
export const RESULT = {
    positive: '#059669',
    negative: '#e11d48',
} as const;

// ---------------------------------------------------------------------------
// Superfícies
// ---------------------------------------------------------------------------

export const SURFACE =
    'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export function Surface({
    title, subtitle, action, children, className = '',
}: {
    title?: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`overflow-hidden ${SURFACE} ${className}`}>
            {(title || action) && (
                <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                        {title && <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>}
                        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
                    </div>
                    {action}
                </header>
            )}
            {children}
        </section>
    );
}

/** Linha de lista com realce à esquerda no hover — feedback claro, sem ruído. */
export function Row({
    active = false, onClick, children, className = '',
}: {
    active?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            onClick={onClick}
            className={`group relative border-b border-slate-100 transition-colors duration-200 last:border-0 ${onClick ? 'cursor-pointer' : ''
                } ${active ? 'bg-slate-50/70' : 'hover:bg-slate-50/70'} ${className}`}
        >
            <span
                className={`absolute inset-y-0 left-0 w-[3px] origin-top bg-slate-900 transition-transform duration-200 ${active ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'
                    }`}
            />
            {children}
        </div>
    );
}

export function EmptyState({
    icon: Icon, title, detail, action,
}: {
    icon: LucideIcon;
    title: string;
    detail?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="px-5 py-16 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="text-[16px] font-semibold text-slate-900">{title}</p>
            {detail && <p className="mt-1 text-[13.5px] text-slate-500">{detail}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

const BTN_BASE =
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-[13.5px] font-semibold transition-colors disabled:opacity-40';

const BTN_VARIANT = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
} as const;

export function Button({
    variant = 'secondary', size = 'md', children, className = '', ...rest
}: {
    variant?: keyof typeof BTN_VARIANT;
    size?: 'sm' | 'md';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...rest}
            className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${size === 'sm' ? 'h-9 px-3' : 'h-10 px-4'} ${className}`}
        >
            {children}
        </button>
    );
}

/** Ação de linha: sempre presente, discreta em repouso, cheia no hover da linha. */
export function RowAction({
    label, icon: Icon, danger = false, onClick,
}: {
    label: string;
    icon: LucideIcon;
    danger?: boolean;
    onClick: (e: React.MouseEvent) => void;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={e => { e.stopPropagation(); onClick(e); }}
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg opacity-45 transition-all duration-200 group-hover:opacity-100 ${danger
                ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700'
                }`}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

// ---------------------------------------------------------------------------
// Campos — sem chrome nativo
// ---------------------------------------------------------------------------

const FIELD_SHELL =
    'flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition-colors hover:border-slate-300 focus-within:border-slate-400';

const FIELD_INPUT =
    'w-full min-w-0 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-300';

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
    return (
        <span className="mb-1.5 flex items-baseline gap-1.5">
            <span className="text-[12.5px] font-semibold text-slate-600">{children}</span>
            {hint && <span className="text-[12px] text-slate-400">{hint}</span>}
        </span>
    );
}

/**
 * Campo de texto.
 *
 * Com `onCommit`, escreve-se livremente e só se grava ao sair do campo ou ao
 * carregar em Enter — evita um pedido por cada tecla quando o valor vai para a
 * base de dados. Com `onChange`, muda a cada tecla (estado local).
 */
export function TextField({
    label, hint, value, onChange, onCommit, placeholder,
}: {
    label?: string;
    hint?: string;
    value: string;
    onChange?: (v: string) => void;
    onCommit?: (v: string) => void;
    placeholder?: string;
}) {
    const [draft, setDraft] = useState(value);
    const [focused, setFocused] = useState(false);
    useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);

    const commit = () => {
        setFocused(false);
        if (onCommit && draft !== value) onCommit(draft);
    };

    return (
        <label className="block">
            {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
            <span className={FIELD_SHELL}>
                <input
                    value={onCommit ? draft : value}
                    onFocus={() => setFocused(true)}
                    onChange={e => { setDraft(e.target.value); onChange?.(e.target.value); }}
                    onBlur={commit}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder={placeholder}
                    className={FIELD_INPUT}
                />
            </span>
        </label>
    );
}

/** Numérico sem as setas do browser, com a unidade dentro do campo. */
export function NumberField({
    label, hint, value, onChange, onCommit, suffix, step = 1,
}: {
    label?: string;
    hint?: string;
    value: number;
    onChange?: (v: number) => void;
    onCommit?: (v: number) => void;
    suffix?: string;
    step?: number;
}) {
    const [draft, setDraft] = useState(value === 0 ? '' : String(value));
    const [focused, setFocused] = useState(false);
    useEffect(() => { if (!focused) setDraft(value === 0 ? '' : String(value)); }, [value, focused]);

    const commit = () => {
        setFocused(false);
        const next = Number(draft) || 0;
        if (onCommit && next !== value) onCommit(next);
    };

    return (
        <label className="block">
            {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
            <span className={FIELD_SHELL}>
                <input
                    type="number"
                    step={step}
                    value={onCommit ? draft : (value === 0 ? '' : value)}
                    onFocus={() => setFocused(true)}
                    onChange={e => { setDraft(e.target.value); onChange?.(Number(e.target.value) || 0); }}
                    onBlur={commit}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder="0"
                    className={`${FIELD_INPUT} tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                />
                {suffix && <span className="flex-shrink-0 text-[13px] text-slate-400">{suffix}</span>}
            </span>
        </label>
    );
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDate(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Data com aspeto nosso. O Safari mostra a data de hoje a cinzento num campo
 * vazio, o que faz parecer preenchido — aqui um campo vazio diz mesmo que está
 * vazio, e o calendário do sistema abre por cima.
 */
export function DateField({
    label, hint, value, onChange, placeholder = 'Escolher data', clearable = false,
}: {
    label?: string;
    hint?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    clearable?: boolean;
}) {
    const ref = useRef<HTMLInputElement>(null);

    const open = () => {
        const el = ref.current;
        if (!el) return;
        if (typeof (el as any).showPicker === 'function') (el as any).showPicker();
        else el.focus();
    };

    return (
        <label className="block">
            {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
            <span className={`${FIELD_SHELL} relative cursor-pointer`} onClick={open}>
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span className={`flex-1 truncate text-[14px] ${value ? 'text-slate-900' : 'text-slate-400'}`}>
                    {value ? formatDate(value) : placeholder}
                </span>
                {clearable && value && (
                    <button
                        type="button"
                        aria-label="Limpar data"
                        onClick={e => { e.stopPropagation(); onChange(''); }}
                        className="flex-shrink-0 rounded text-slate-300 transition-colors hover:text-rose-600"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
                <input
                    ref={ref}
                    type="date"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                    tabIndex={-1}
                />
            </span>
        </label>
    );
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export function Pill({
    role, children, dot = true,
}: {
    role: Role;
    children: React.ReactNode;
    dot?: boolean;
}) {
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${roleBadge(role)}`}>
            {dot && <span className={`h-1.5 w-1.5 rounded-full ${roleDot(role)}`} />}
            {children}
        </span>
    );
}

export type PillOption<T extends string> = { value: T; label: string; role: Role };

/** Pill que abre um menu. Substitui o `<select>` nativo, que traz o chrome do browser. */
export function PillSelect<T extends string>({
    value, options, onChange, width = 'w-[126px]',
}: {
    value: T;
    options: PillOption<T>[];
    onChange: (v: T) => void;
    width?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find(o => o.value === value) ?? options[0];

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className={`inline-flex ${width} items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset transition-shadow hover:ring-[1.5px] ${roleBadge(current.role)}`}
            >
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${roleDot(current.role)}`} />
                <span className="flex-1 truncate text-left">{current.label}</span>
                <ChevronDown className={`h-3 w-3 flex-shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
                    >
                        {options.map(o => (
                            <button
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${roleDot(o.role)}`} />
                                <span className="flex-1">{o.label}</span>
                                {o.value === value && <Check className="h-4 w-4 text-slate-400" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Blocos de conta
// ---------------------------------------------------------------------------

export function Amount({
    value, sub, subRole = 'neutral',
}: {
    value: string;
    sub?: string;
    subRole?: Role;
}) {
    const subInk =
        subRole === 'done' ? 'text-emerald-600'
            : subRole === 'alert' ? 'text-rose-600'
                : 'text-slate-500';
    return (
        <div className="text-right">
            <div className="text-[15px] font-semibold tabular-nums text-slate-900">{value}</div>
            {sub && <div className={`mt-0.5 text-[13px] tabular-nums ${subInk}`}>{sub}</div>}
        </div>
    );
}

export function LedgerLine({
    label, value, role = 'neutral', strong = false,
}: {
    label: string;
    value: string;
    role?: Role;
    strong?: boolean;
}) {
    const ink =
        role === 'done' ? 'text-emerald-600'
            : role === 'alert' ? 'text-rose-600'
                : 'text-slate-900';
    return (
        <div className={`flex items-baseline justify-between gap-3 ${strong ? 'border-t border-slate-200 pt-2.5' : ''}`}>
            <span className={strong ? 'text-[14px] font-semibold text-slate-900' : 'text-[13.5px] text-slate-500'}>
                {label}
            </span>
            <span className={`tabular-nums ${strong ? 'text-[17px] font-bold tracking-tight' : 'text-[14px] font-medium'} ${ink}`}>
                {value}
            </span>
        </div>
    );
}

/** Coluna do editor expandido. Sem caixa: separadores verticais, menos ruído. */
export function EditorColumn({
    title, children, className = '',
}: {
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex flex-col gap-3.5 lg:border-l lg:border-slate-200/70 lg:pl-6 lg:first:border-0 lg:first:pl-0 ${className}`}>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400">{title}</h4>
            {children}
        </div>
    );
}
