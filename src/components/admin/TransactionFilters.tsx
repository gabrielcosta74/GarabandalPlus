"use client";

import React from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Search, X, SlidersHorizontal, Check } from 'lucide-react';

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
    if (filters.includeFuture) {
        chips.push({ key: 'future', label: 'Inclui datas futuras', onRemove: () => update('includeFuture', false) });
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {/* Pesquisa */}
                <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        placeholder="Pesquisar por nome, email, NIF, referência ou descrição…"
                        value={filters.search}
                        onChange={e => update('search', e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
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
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:border-slate-400 focus:outline-none"
                >
                    {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(key => (
                        <option key={key} value={key}>{DATE_PRESET_LABELS[key]}</option>
                    ))}
                </select>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
                    <input
                        type="date"
                        aria-label="Data inicial"
                        value={filters.dateFrom}
                        max={filters.dateTo || undefined}
                        onChange={e => setCustomDate('dateFrom', e.target.value)}
                        className="w-[112px] bg-transparent font-mono text-xs text-slate-700 focus:outline-none"
                    />
                    <span className="text-slate-300">→</span>
                    <input
                        type="date"
                        aria-label="Data final"
                        value={filters.dateTo}
                        min={filters.dateFrom || undefined}
                        onChange={e => setCustomDate('dateTo', e.target.value)}
                        className="w-[112px] bg-transparent font-mono text-xs text-slate-700 focus:outline-none"
                    />
                </div>

                {/* Filtros avançados */}
                <Popover className="relative">
                    <Popover.Button
                        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus:outline-none ${advancedCount > 0
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filtros
                        {advancedCount > 0 && (
                            <span className="rounded bg-white/20 px-1.5 text-[11px] font-semibold tabular-nums">
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
                        <Popover.Panel className="absolute right-0 z-30 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5">
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

                                <label className="flex cursor-pointer items-start gap-2 border-t border-slate-100 pt-3">
                                    <input
                                        type="checkbox"
                                        checked={filters.includeFuture}
                                        onChange={e => update('includeFuture', e.target.checked)}
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span className="text-xs leading-snug text-slate-600">
                                        Incluir datas futuras
                                        <span className="mt-0.5 block text-[11px] text-slate-400">
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
                <div className="flex flex-wrap items-center gap-1.5">
                    {chips.map(chip => (
                        <button
                            key={chip.key}
                            onClick={chip.onRemove}
                            className="group inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white"
                        >
                            {chip.label}
                            <X className="h-3 w-3 text-slate-400 transition-colors group-hover:text-rose-500" />
                        </button>
                    ))}
                    <button
                        onClick={() => setFilters(DEFAULT_TRANSACTION_FILTERS)}
                        className="ml-1 text-xs font-medium text-slate-400 underline-offset-2 transition-colors hover:text-slate-700 hover:underline"
                    >
                        limpar tudo
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
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <div className="space-y-0.5">
                {options.map(([key, text]) => (
                    <button
                        key={key}
                        onClick={() => onChange(key)}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${value === key ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        {text}
                        {value === key && <Check className="h-3.5 w-3.5 text-slate-900" />}
                    </button>
                ))}
            </div>
        </div>
    );
}
