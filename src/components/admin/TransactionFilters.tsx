"use client";

import React from 'react';
import { Search, X } from 'lucide-react';

export type TransactionFiltersState = {
    category: string;
    status: string;
    search: string;
};

type TransactionFiltersProps = {
    filters: TransactionFiltersState;
    setFilters: React.Dispatch<React.SetStateAction<TransactionFiltersState>>;
};

const FilterPill = ({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${active
            ? 'bg-garabandal-gold text-garabandal-dark border-garabandal-gold shadow-sm'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
    >
        {label}
    </button>
);

const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 pl-1">{title}</span>
        <div className="flex flex-wrap gap-2">
            {children}
        </div>
    </div>
);

export default function TransactionFilters({ filters, setFilters }: TransactionFiltersProps) {

    const updateFilter = (key: keyof TransactionFiltersState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const hasActiveFilters =
        filters.category !== 'all' ||
        filters.status !== 'all' ||
        filters.search !== '';

    const clearFilters = () => {
        setFilters({
            category: 'all',
            status: 'all',
            search: '',
        });
    };

    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">

            {/* Top Row: Search & Clear */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar por Nome, Email ou Referência..."
                        value={filters.search}
                        onChange={(e) => updateFilter('search', e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-garabandal-gold focus:ring-1 focus:ring-garabandal-gold/20 transition-all"
                    />
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <X className="w-3 h-3" /> Limpar Filtros
                    </button>
                )}
            </div>

            <div className="h-px bg-gray-50 w-full" />

            {/* Filter Groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FilterSection title="Origem (Workflow)">
                    <FilterPill label="Todas" active={filters.category === 'all'} onClick={() => updateFilter('category', 'all')} />
                    <FilterPill label="Loja Online" active={filters.category === 'shop'} onClick={() => updateFilter('category', 'shop')} />
                    <FilterPill label="Doações" active={filters.category === 'donation'} onClick={() => updateFilter('category', 'donation')} />
                    <FilterPill label="Quotas" active={filters.category === 'quota'} onClick={() => updateFilter('category', 'quota')} />
                    <FilterPill label="Peregrinações" active={filters.category === 'pilgrimage'} onClick={() => updateFilter('category', 'pilgrimage')} />
                </FilterSection>

                <FilterSection title="Estado Financeiro">
                    <FilterPill label="Todos" active={filters.status === 'all'} onClick={() => updateFilter('status', 'all')} />
                    <FilterPill label="Confirmados / Pagos" active={filters.status === 'paid'} onClick={() => updateFilter('status', 'paid')} />
                    <FilterPill label="Pendentes" active={filters.status === 'pending'} onClick={() => updateFilter('status', 'pending')} />
                    <FilterPill label="Falhados" active={filters.status === 'failed'} onClick={() => updateFilter('status', 'failed')} />
                </FilterSection>

            </div>
        </div>
    );
}
