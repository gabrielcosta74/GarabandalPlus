"use client";

import React from 'react';
import { Search, X } from 'lucide-react';

export type OrderFiltersState = {
    status: string;
    shipping: string;
    invoice: string;
    type: string;
    country: string;
    search: string;
};

type OrderFiltersProps = {
    filters: OrderFiltersState;
    setFilters: React.Dispatch<React.SetStateAction<OrderFiltersState>>;
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

export default function OrderFilters({ filters, setFilters }: OrderFiltersProps) {

    const updateFilter = (key: keyof OrderFiltersState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const hasActiveFilters =
        filters.status !== 'all' ||
        filters.shipping !== 'all' ||
        filters.invoice !== 'all' ||
        filters.type !== 'all' ||
        filters.country !== 'all' ||
        filters.search !== '';

    const clearFilters = () => {
        setFilters({
            status: 'all',
            shipping: 'all',
            invoice: 'all',
            type: 'all',
            country: 'all',
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
                        placeholder="Pesquisar por Referência, Nome, Email ou NIF..."
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <FilterSection title="Estado Pagamento">
                    <FilterPill label="Todos" active={filters.status === 'all'} onClick={() => updateFilter('status', 'all')} />
                    <FilterPill label="Pago" active={filters.status === 'paid'} onClick={() => updateFilter('status', 'paid')} />
                    <FilterPill label="Pendente" active={filters.status === 'pending'} onClick={() => updateFilter('status', 'pending')} />
                </FilterSection>

                <FilterSection title="Logística (Físico)">
                    <FilterPill label="Todos" active={filters.shipping === 'all'} onClick={() => updateFilter('shipping', 'all')} />
                    <FilterPill label="Por Enviar" active={filters.shipping === 'por enviar'} onClick={() => updateFilter('shipping', 'por enviar')} />
                    <FilterPill label="Enviado" active={filters.shipping === 'enviado'} onClick={() => updateFilter('shipping', 'enviado')} />
                </FilterSection>

                <FilterSection title="Estado Fatura">
                    <FilterPill label="Todas" active={filters.invoice === 'all'} onClick={() => updateFilter('invoice', 'all')} />
                    <FilterPill label="Em Falta" active={filters.invoice === 'pending'} onClick={() => updateFilter('invoice', 'pending')} />
                    <FilterPill label="Enviada" active={filters.invoice === 'sent'} onClick={() => updateFilter('invoice', 'sent')} />
                </FilterSection>

                <FilterSection title="Tipo produto">
                    <FilterPill label="Todos" active={filters.type === 'all'} onClick={() => updateFilter('type', 'all')} />
                    <FilterPill label="Físico" active={filters.type === 'fisico'} onClick={() => updateFilter('type', 'fisico')} />
                    <FilterPill label="Digital" active={filters.type === 'digital'} onClick={() => updateFilter('type', 'digital')} />
                </FilterSection>

            </div>
        </div>
    );
}
