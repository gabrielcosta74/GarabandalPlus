"use client";

import React from 'react';
import { Popover, Transition } from '@headlessui/react';
import { CalendarDays, Check, Search, SlidersHorizontal, X } from 'lucide-react';

export type DatePreset =
    | 'all'
    | 'today'
    | 'last7'
    | 'last30'
    | 'this_month'
    | 'last_month'
    | 'this_year'
    | 'custom';

export type TransactionFiltersState = {
    category: 'all' | 'shop' | 'donation' | 'quota' | 'pilgrimage';
    /** 'active' = pagos + pendentes, o que interessa no dia-a-dia. */
    status: 'active' | 'all' | 'paid' | 'pending' | 'failed';
    fiscalStatus:
        | 'all'
        | 'manual'
        | 'unregistered'
        | 'awaiting_approval'
        | 'pending'
        | 'needs_data'
        | 'processing'
        | 'issued'
        | 'failed'
        | 'email_failed';
    fiscalSeries: 'all' | '2026Q' | '2026L' | '2026D';
    nif: 'all' | 'with_nif' | 'without_nif';
    search: string;
    datePreset: DatePreset;
    /** Formato YYYY-MM-DD. Preenchê-los ativa o preset 'custom'. */
    dateFrom: string;
    dateTo: string;
    /**
     * Quotas legacy pagas adiantadamente ficam datadas a 1 de Janeiro do ano que cobrem,
     * portanto no futuro. Ficam fora por omissão para não encabeçarem a lista.
     */
    includeFuture: boolean;
};

export const DEFAULT_TRANSACTION_FILTERS: TransactionFiltersState = {
    category: 'all',
    status: 'active',
    fiscalStatus: 'all',
    fiscalSeries: 'all',
    nif: 'all',
    search: '',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    includeFuture: false,
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * Converte o filtro de datas num intervalo concreto (limites inclusivos).
 * Devolve null em cada extremo quando não há limite.
 */
export function resolveDateRange(filters: TransactionFiltersState): { from: Date | null; to: Date | null } {
    const now = new Date();
    const range = rawDateRange(filters, now);

    // Salvo pedido explícito, o limite superior nunca passa de hoje.
    if (!filters.includeFuture) {
        const today = endOfDay(now);
        if (!range.to || range.to.getTime() > today.getTime()) range.to = today;
    }

    return range;
}

function rawDateRange(filters: TransactionFiltersState, now: Date): { from: Date | null; to: Date | null } {
    switch (filters.datePreset) {
        case 'today':
            return { from: startOfDay(now), to: endOfDay(now) };
        case 'last7':
            return { from: startOfDay(new Date(now.getTime() - 6 * 86400000)), to: endOfDay(now) };
        case 'last30':
            return { from: startOfDay(new Date(now.getTime() - 29 * 86400000)), to: endOfDay(now) };
        case 'this_month':
            return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
        case 'last_month':
            return {
                from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
            };
        case 'this_year':
            return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
        case 'custom': {
            const from = filters.dateFrom ? startOfDay(new Date(`${filters.dateFrom}T00:00:00`)) : null;
            const to = filters.dateTo ? endOfDay(new Date(`${filters.dateTo}T00:00:00`)) : null;
            return {
                from: from && !Number.isNaN(from.getTime()) ? from : null,
                to: to && !Number.isNaN(to.getTime()) ? to : null,
            };
        }
        default:
            return { from: null, to: null };
    }
}

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
    all: 'Sempre',
    today: 'Hoje',
    last7: 'Últimos 7 dias',
    last30: 'Últimos 30 dias',
    this_month: 'Este mês',
    last_month: 'Mês passado',
    this_year: 'Este ano',
    custom: 'Intervalo',
};

const CATEGORY_LABELS: Record<TransactionFiltersState['category'], string> = {
    all: 'Todas as origens',
    pilgrimage: 'Peregrinações',
    donation: 'Doações',
    quota: 'Quotas',
    shop: 'Loja',
};

const STATUS_LABELS: Record<TransactionFiltersState['status'], string> = {
    active: 'Pagos + pendentes',
    all: 'Todos os estados',
    paid: 'Pagos',
    pending: 'Pendentes',
    failed: 'Falhados',
};

const NIF_LABELS: Record<TransactionFiltersState['nif'], string> = {
    all: 'Todos',
    with_nif: 'Com NIF',
    without_nif: 'Sem NIF',
};

const FISCAL_STATUS_LABELS: Record<TransactionFiltersState['fiscalStatus'], string> = {
    all: 'Todos',
    manual: 'Emitida manualmente',
    unregistered: 'Sem registo fiscal',
    awaiting_approval: 'Aguarda aprovação',
    pending: 'Por emitir',
    needs_data: 'Requer dados',
    processing: 'A processar',
    issued: 'Emitido',
    failed: 'Erro de emissão',
    email_failed: 'Erro de email',
};

const FISCAL_SERIES_LABELS: Record<TransactionFiltersState['fiscalSeries'], string> = {
    all: 'Todas',
    '2026Q': '2026Q · Quotas',
    '2026L': '2026L · Loja',
    '2026D': '2026D · Doações',
};

type TransactionFiltersProps = {
    filters: TransactionFiltersState;
    setFilters: React.Dispatch<React.SetStateAction<TransactionFiltersState>>;
};

export default function TransactionFilters({ filters, setFilters }: TransactionFiltersProps) {
    const update = <K extends keyof TransactionFiltersState>(key: K, value: TransactionFiltersState[K]) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    const setCustomDate = (key: 'dateFrom' | 'dateTo', value: string) =>
        setFilters(prev => ({ ...prev, [key]: value, datePreset: 'custom' }));

    const advancedCount =
        (filters.category !== 'all' ? 1 : 0) +
        (filters.status !== 'active' ? 1 : 0) +
        (filters.fiscalStatus !== 'all' ? 1 : 0) +
        (filters.fiscalSeries !== 'all' ? 1 : 0) +
        (filters.nif !== 'all' ? 1 : 0) +
        (filters.includeFuture ? 1 : 0);

    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.search.trim()) {
        chips.push({
            key: 'search',
            label: `“${filters.search.trim()}”`,
            onRemove: () => update('search', ''),
        });
    }
    if (filters.datePreset !== 'all') {
        const label = filters.datePreset === 'custom'
            ? `${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`
            : DATE_PRESET_LABELS[filters.datePreset];
        chips.push({
            key: 'date',
            label,
            onRemove: () => setFilters(prev => ({ ...prev, datePreset: 'all', dateFrom: '', dateTo: '' })),
        });
    }
    if (filters.category !== 'all') {
        chips.push({ key: 'category', label: CATEGORY_LABELS[filters.category], onRemove: () => update('category', 'all') });
    }
    if (filters.status !== 'active') {
        chips.push({ key: 'status', label: STATUS_LABELS[filters.status], onRemove: () => update('status', 'active') });
    }
    if (filters.nif !== 'all') {
        chips.push({ key: 'nif', label: NIF_LABELS[filters.nif], onRemove: () => update('nif', 'all') });
    }
    if (filters.fiscalStatus !== 'all') {
        chips.push({
            key: 'fiscal-status',
            label: `FACT: ${FISCAL_STATUS_LABELS[filters.fiscalStatus]}`,
            onRemove: () => update('fiscalStatus', 'all'),
        });
    }
    if (filters.fiscalSeries !== 'all') {
        chips.push({
            key: 'fiscal-series',
            label: `Série ${filters.fiscalSeries}`,
            onRemove: () => update('fiscalSeries', 'all'),
        });
    }
    if (filters.includeFuture) {
        chips.push({ key: 'future', label: 'Inclui datas futuras', onRemove: () => update('includeFuture', false) });
    }

    return (
        <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-3">
                {/* Pesquisa */}
                <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                        type="search"
                        placeholder="Nome, email, NIF, referência ou descrição"
                        value={filters.search}
                        onChange={e => update('search', e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200/80 bg-white pl-11 pr-3.5 text-[14.5px] text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                    />
                </div>

                {/* Período */}
                <select
                    value={filters.datePreset}
                    onChange={e => setFilters(prev => ({
                        ...prev,
                        datePreset: e.target.value as DatePreset,
                        ...(e.target.value === 'custom' ? {} : { dateFrom: '', dateTo: '' }),
                    }))}
                    className="h-11 cursor-pointer rounded-xl border border-slate-200/80 bg-white px-3.5 text-[14px] font-semibold text-slate-700 outline-none transition-all duration-200 hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                >
                    {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(key => (
                        <option key={key} value={key}>{DATE_PRESET_LABELS[key]}</option>
                    ))}
                </select>

                <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3">
                    <CalendarDays className="h-[18px] w-[18px] flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                        type="date"
                        aria-label="Data inicial"
                        value={filters.dateFrom}
                        max={filters.dateTo || undefined}
                        onChange={e => setCustomDate('dateFrom', e.target.value)}
                        className="w-[118px] bg-transparent text-[13.5px] font-medium text-slate-700 outline-none"
                    />
                    <span className="text-slate-300">–</span>
                    <input
                        type="date"
                        aria-label="Data final"
                        value={filters.dateTo}
                        min={filters.dateFrom || undefined}
                        onChange={e => setCustomDate('dateTo', e.target.value)}
                        className="w-[118px] bg-transparent text-[13.5px] font-medium text-slate-700 outline-none"
                    />
                </div>

                {/* Filtros avançados */}
                <Popover className="relative">
                    <Popover.Button
                        className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[14px] font-semibold transition-all duration-200 focus:outline-none ${advancedCount > 0
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} />
                        Filtros
                        {advancedCount > 0 && (
                            <span className="rounded-full bg-white/20 px-1.5 text-[12px] font-bold tabular-nums">
                                {advancedCount}
                            </span>
                        )}
                    </Popover.Button>

                    <Transition
                        as={React.Fragment}
                        enter="transition ease-out duration-150"
                        enterFrom="opacity-0 translate-y-1"
                        enterTo="opacity-100 translate-y-0"
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100 translate-y-0"
                        leaveTo="opacity-0 translate-y-1"
                    >
                        <Popover.Panel className="absolute right-0 z-30 mt-2 max-h-[75vh] w-80 origin-top-right overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                            <div className="space-y-4">
                                <RadioGroup
                                    label="Origem"
                                    value={filters.category}
                                    onChange={v => update('category', v)}
                                    options={Object.entries(CATEGORY_LABELS) as [TransactionFiltersState['category'], string][]}
                                />
                                <RadioGroup
                                    label="Estado"
                                    value={filters.status}
                                    onChange={v => update('status', v)}
                                    options={Object.entries(STATUS_LABELS) as [TransactionFiltersState['status'], string][]}
                                />
                                <RadioGroup
                                    label="NIF"
                                    value={filters.nif}
                                    onChange={v => update('nif', v)}
                                    options={Object.entries(NIF_LABELS) as [TransactionFiltersState['nif'], string][]}
                                />
                                <RadioGroup
                                    label="Estado FACT.pt"
                                    value={filters.fiscalStatus}
                                    onChange={v => update('fiscalStatus', v)}
                                    options={Object.entries(FISCAL_STATUS_LABELS) as [TransactionFiltersState['fiscalStatus'], string][]}
                                />
                                <RadioGroup
                                    label="Série FACT.pt"
                                    value={filters.fiscalSeries}
                                    onChange={v => update('fiscalSeries', v)}
                                    options={Object.entries(FISCAL_SERIES_LABELS) as [TransactionFiltersState['fiscalSeries'], string][]}
                                />

                                <label className="flex cursor-pointer items-start gap-2 border-t border-slate-100 pt-3">
                                    <input
                                        type="checkbox"
                                        checked={filters.includeFuture}
                                        onChange={e => update('includeFuture', e.target.checked)}
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span className="text-[13.5px] font-medium leading-snug text-slate-600">
                                        Incluir datas futuras
                                        <span className="mt-0.5 block text-[12.5px] font-normal text-slate-400">
                                            Quotas pagas adiantadamente foram importadas com data de 1 de Janeiro do ano que cobrem.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </Popover.Panel>
                    </Transition>
                </Popover>
            </div>

            {/* Chips do que está aplicado */}
            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {chips.map(chip => (
                        <button
                            key={chip.key}
                            onClick={chip.onRemove}
                            className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100/80 pl-3 pr-2 text-[13px] font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-200/70 hover:text-slate-900"
                        >
                            {chip.label}
                            <X className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-rose-500" />
                        </button>
                    ))}
                    <button
                        onClick={() => setFilters(DEFAULT_TRANSACTION_FILTERS)}
                        className="ml-1 inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                    >
                        Limpar tudo
                    </button>
                </div>
            )}
        </div>
    );
}

function RadioGroup<T extends string>({ label, value, onChange, options }: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: [T, string][];
}) {
    return (
        <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
            <div className="space-y-0.5">
                {options.map(([key, text]) => (
                    <button
                        key={key}
                        onClick={() => onChange(key)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors duration-150 ${value === key ? 'bg-slate-900/[0.055] font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        {text}
                        {value === key && <Check className="h-4 w-4 text-slate-900" strokeWidth={2.5} />}
                    </button>
                ))}
            </div>
        </div>
    );
}
