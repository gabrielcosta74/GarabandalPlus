"use client";

import { ChevronDown, ChevronRight, FileText, Search, X } from 'lucide-react';

import { cn } from '../../../lib/utils';
import FactptPeriodPicker, { type FactptPeriod } from './FactptPeriodPicker';
import FactptStatusBadge from './FactptStatusBadge';
import type { FactptDocument, FactptSourceType, FactptStatus } from './types';
import { formatCount, formatDate, formatMoney, SOURCE_META } from './ui';

/** `incidents` agrupa os dois estados de erro num só atalho. */
export type StatusFilter = FactptStatus | 'all' | 'incidents';

export type DocumentFilters = {
    search: string;
    status: StatusFilter;
    source: FactptSourceType | 'all';
};

export const EMPTY_DOCUMENT_FILTERS: DocumentFilters = {
    search: '',
    status: 'all',
    source: 'all',
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos os estados' },
    { value: 'awaiting_approval', label: 'Por aprovar' },
    { value: 'needs_data', label: 'Requer dados' },
    { value: 'pending', label: 'Na fila' },
    { value: 'processing', label: 'A processar' },
    { value: 'issued', label: 'Emitida' },
    { value: 'incidents', label: 'Incidentes' },
    { value: 'failed', label: 'Erro na emissão' },
    { value: 'email_failed', label: 'Email por enviar' },
];

const QUICK_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'awaiting_approval', label: 'Por aprovar' },
    { value: 'needs_data', label: 'Requer dados' },
    { value: 'issued', label: 'Emitidas' },
    { value: 'incidents', label: 'Incidentes' },
];

export function matchesStatusFilter(document: FactptDocument, status: StatusFilter) {
    if (status === 'all') return true;
    if (status === 'incidents') return document.status === 'failed' || document.status === 'email_failed';
    return document.status === status;
}

export default function FactptDocumentsPanel({
    documents,
    filters,
    onFiltersChange,
    onClearFilters,
    hasFilters,
    counts,
    period,
    onPeriodChange,
    onSelect,
}: {
    documents: FactptDocument[];
    filters: DocumentFilters;
    onFiltersChange: (filters: DocumentFilters) => void;
    onClearFilters: () => void;
    hasFilters: boolean;
    counts: Record<StatusFilter, number>;
    period: FactptPeriod;
    onPeriodChange: (period: FactptPeriod) => void;
    onSelect: (id: string) => void;
}) {
    return (
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <header className="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-5">
                <h2 className="text-[19px] font-bold tracking-tight text-slate-900">Documentos</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-semibold text-slate-600 tabular-nums">
                    {formatCount(documents.length)}{documents.length === 1 ? ' documento' : ' documentos'}
                </span>
            </header>

            {/* Atalhos de estado — o caminho rápido para o trabalho do dia */}
            <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
                {QUICK_FILTERS.map((quick) => {
                    const isActive = filters.status === quick.value;
                    const count = counts[quick.value] || 0;
                    return (
                        <button
                            key={quick.value}
                            type="button"
                            onClick={() => onFiltersChange({ ...filters, status: quick.value })}
                            aria-pressed={isActive}
                            className={cn(
                                'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-semibold transition-all duration-200',
                                isActive
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                            )}
                        >
                            {quick.label}
                            <span className={cn(
                                'rounded-full px-1.5 text-[12px] font-bold tabular-nums',
                                isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                            )}>
                                {formatCount(count)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-y border-slate-100 bg-slate-50/50 px-5 py-3.5">
                <label className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <span className="sr-only">Pesquisar documentos</span>
                    <input
                        type="search"
                        placeholder="Número, cliente, email ou NIF"
                        value={filters.search}
                        onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-200/80 bg-white pl-11 pr-3.5 text-[14.5px] text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
                    />
                </label>

                <FactptPeriodPicker period={period} onChange={onPeriodChange} />

                <SelectField
                    label="Filtrar por estado"
                    value={filters.status}
                    onChange={(value) => onFiltersChange({ ...filters, status: value as StatusFilter })}
                    options={STATUS_OPTIONS}
                />

                <SelectField
                    label="Filtrar por origem"
                    value={filters.source}
                    onChange={(value) => onFiltersChange({ ...filters, source: value as DocumentFilters['source'] })}
                    options={[
                        { value: 'all', label: 'Todas as origens' },
                        ...(Object.keys(SOURCE_META) as FactptSourceType[]).map((value) => ({
                            value,
                            label: SOURCE_META[value].label,
                        })),
                    ]}
                />

                {hasFilters && (
                    <button
                        type="button"
                        onClick={onClearFilters}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-slate-500 transition-colors duration-200 hover:bg-slate-200/60 hover:text-slate-900"
                    >
                        <X className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                        Limpar
                    </button>
                )}
            </div>

            {documents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <FileText className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <strong className="mt-1 text-[16px] font-semibold text-slate-900">
                        {hasFilters ? 'Nenhum resultado' : 'Ainda não existem documentos'}
                    </strong>
                    <p className="max-w-sm text-[14px] text-slate-500">
                        {hasFilters
                            ? 'Experimenta remover os filtros ou pesquisar outra referência.'
                            : 'Os documentos fiscais aparecem aqui quando entram no sistema.'}
                    </p>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className="mt-2 inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop: tabela densa mas legível */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    {['Documento', 'Cliente', 'Origem', 'Estado'].map((heading) => (
                                        <th key={heading} className="px-5 py-3 text-[12px] font-bold uppercase tracking-[0.07em] text-slate-400">
                                            {heading}
                                        </th>
                                    ))}
                                    <th className="px-5 py-3 text-right text-[12px] font-bold uppercase tracking-[0.07em] text-slate-400">Total</th>
                                    <th className="w-10 px-5 py-3"><span className="sr-only">Abrir</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {documents.map((document) => {
                                    const source = SOURCE_META[document.sourceType];
                                    const SourceIcon = source.icon;
                                    return (
                                        <tr
                                            key={document.id}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`Abrir ${document.factptNumber || 'documento'}`}
                                            onClick={() => onSelect(document.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    onSelect(document.id);
                                                }
                                            }}
                                            className="group cursor-pointer transition-colors duration-200 hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none"
                                        >
                                            <td className="px-5 py-3.5">
                                                <strong className="block text-[14.5px] font-semibold text-slate-900">
                                                    {document.factptNumber || `${document.seriesCode || 'FACT.pt'} · por numerar`}
                                                </strong>
                                                <small className="mt-0.5 block text-[13px] text-slate-500">
                                                    {formatDate(document.paymentConfirmedAt || document.createdAt)}
                                                </small>
                                            </td>
                                            <td className="max-w-[220px] px-5 py-3.5">
                                                <strong className="block truncate text-[14.5px] font-medium text-slate-800">
                                                    {document.customer.name || 'Cliente por confirmar'}
                                                </strong>
                                                <small className="mt-0.5 block truncate text-[13px] text-slate-500">
                                                    {document.customer.nif || document.customer.email || 'Sem dados fiscais'}
                                                </small>
                                            </td>
                                            <td className="max-w-[200px] px-5 py-3.5">
                                                <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-slate-600">
                                                    <SourceIcon className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} aria-hidden="true" />
                                                    <span className="truncate">{source.label}</span>
                                                </span>
                                                {document.sourceLabel && (
                                                    <small className="mt-0.5 block truncate text-[13px] text-slate-500" title={document.sourceLabel}>
                                                        {document.sourceLabel}
                                                    </small>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <FactptStatusBadge status={document.status} />
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-[15px] font-semibold text-slate-900 tabular-nums">
                                                {formatMoney(document.amount, document.currency)}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <ChevronRight
                                                    className="h-[18px] w-[18px] text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500"
                                                    aria-hidden="true"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: cartões */}
                    <ul className="divide-y divide-slate-100 md:hidden">
                        {documents.map((document) => {
                            const source = SOURCE_META[document.sourceType];
                            return (
                                <li key={document.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(document.id)}
                                        className="flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-slate-50/80"
                                    >
                                        <span className="flex items-start justify-between gap-3">
                                            <span className="min-w-0">
                                                <strong className="block truncate text-[15px] font-semibold text-slate-900">
                                                    {document.factptNumber || `${document.seriesCode || 'FACT.pt'} · por numerar`}
                                                </strong>
                                                <small className="mt-0.5 block truncate text-[13px] text-slate-500">
                                                    {document.sourceLabel || source.label} · {formatDate(document.paymentConfirmedAt || document.createdAt)}
                                                </small>
                                            </span>
                                            <span className="flex-shrink-0 text-[15px] font-bold text-slate-900 tabular-nums">
                                                {formatMoney(document.amount, document.currency)}
                                            </span>
                                        </span>
                                        <span className="flex items-center justify-between gap-3">
                                            <span className="min-w-0 truncate text-[13.5px] text-slate-600">
                                                {document.customer.name || document.customer.email || 'Cliente por confirmar'}
                                            </span>
                                            <FactptStatusBadge status={document.status} />
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="relative">
            <select
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 cursor-pointer appearance-none rounded-xl border border-slate-200/80 bg-white pl-3.5 pr-9 text-[14px] font-medium text-slate-700 outline-none transition-all duration-200 hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        </div>
    );
}
