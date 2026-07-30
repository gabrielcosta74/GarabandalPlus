"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

import { cn } from '../../../lib/utils';

export type PeriodPreset = 'month' | '30d' | 'all' | 'custom';

export type FactptPeriod = {
    preset: PeriodPreset;
    /** Apenas no preset `custom`, em formato YYYY-MM-DD. */
    from: string | null;
    to: string | null;
};

export const DEFAULT_PERIOD: FactptPeriod = { preset: 'month', from: null, to: null };

const PRESETS: { value: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
    { value: 'month', label: 'Este mês' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: 'all', label: 'Todo o histórico' },
];

const shortDate = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' });

function formatDay(value: string | null) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : shortDate.format(date);
}

export function periodLabel(period: FactptPeriod) {
    if (period.preset === 'custom' && period.from && period.to) {
        return `${formatDay(period.from)} – ${formatDay(period.to)}`;
    }
    return PRESETS.find((preset) => preset.value === period.preset)?.label || 'Este mês';
}

/** Converte o período escolhido na janela que a API espera. */
export function periodToRange(period: FactptPeriod): { from?: string; to?: string } {
    if (period.preset === 'month') return {};
    const now = new Date();
    if (period.preset === '30d') {
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        return { from: from.toISOString(), to: now.toISOString() };
    }
    if (period.preset === 'custom' && period.from && period.to) {
        return {
            from: new Date(`${period.from}T00:00:00`).toISOString(),
            to: new Date(`${period.to}T23:59:59.999`).toISOString(),
        };
    }
    return { from: '2000-01-01T00:00:00.000Z', to: now.toISOString() };
}

export default function FactptPeriodPicker({
    period,
    onChange,
}: {
    period: FactptPeriod;
    onChange: (period: FactptPeriod) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({ from: period.from || '', to: period.to || '' });
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const rangeValid = Boolean(draft.from && draft.to && draft.from <= draft.to);

    const applyPreset = (preset: Exclude<PeriodPreset, 'custom'>) => {
        onChange({ preset, from: null, to: null });
        setOpen(false);
    };

    const applyRange = () => {
        if (!rangeValid) return;
        onChange({ preset: 'custom', from: draft.from, to: draft.to });
        setOpen(false);
    };

    return (
        <div className="relative" ref={rootRef}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-haspopup="dialog"
                className={cn(
                    'inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-3.5 text-[14px] font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300',
                    open ? 'border-slate-300 ring-2 ring-slate-900/10' : 'border-slate-200/80'
                )}
            >
                <CalendarDays className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} aria-hidden="true" />
                {periodLabel(period)}
                <ChevronDown
                    className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
                    aria-hidden="true"
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="dialog"
                        aria-label="Escolher período"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 z-30 mt-2 w-[290px] origin-top rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                    >
                        {PRESETS.map((preset) => {
                            const isActive = period.preset === preset.value;
                            return (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => applyPreset(preset.value)}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors duration-150',
                                        isActive
                                            ? 'bg-slate-900/[0.055] font-semibold text-slate-900'
                                            : 'font-medium text-slate-600 hover:bg-slate-100'
                                    )}
                                >
                                    {preset.label}
                                    {isActive && <Check className="ml-auto h-4 w-4 text-slate-900" strokeWidth={2.5} aria-hidden="true" />}
                                </button>
                            );
                        })}

                        <div className="mt-2 border-t border-slate-100 px-3 pb-1 pt-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                                Intervalo personalizado
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                <label className="flex-1">
                                    <span className="sr-only">Data inicial</span>
                                    <input
                                        type="date"
                                        value={draft.from}
                                        max={draft.to || undefined}
                                        onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13.5px] font-medium text-slate-700 outline-none transition-all duration-200 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                                    />
                                </label>
                                <span className="text-slate-300">–</span>
                                <label className="flex-1">
                                    <span className="sr-only">Data final</span>
                                    <input
                                        type="date"
                                        value={draft.to}
                                        min={draft.from || undefined}
                                        onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13.5px] font-medium text-slate-700 outline-none transition-all duration-200 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                                    />
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={applyRange}
                                disabled={!rangeValid}
                                className="mt-2.5 h-10 w-full rounded-lg bg-slate-900 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                            >
                                Aplicar intervalo
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
