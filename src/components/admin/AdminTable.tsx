
"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Filter, ArrowUpDown } from 'lucide-react';

type Column<T> = {
    key: string;
    header: string;
    render?: (item: T) => React.ReactNode;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
};

type AdminTableProps<T> = {
    data: T[];
    columns: Column<T>[];
    isLoading?: boolean;
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
    itemsPerPage?: number;
    actions?: (item: T) => React.ReactNode;
    onRowClick?: (item: T) => void;
};

export default function AdminTable<T extends { id: string | number }>({
    data,
    columns,
    isLoading,
    searchPlaceholder = "Pesquisar...",
    onSearch,
    itemsPerPage = 10,
    actions,
    onRowClick
}: AdminTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Search
    const filteredData = React.useMemo(() => {
        if (!searchQuery) return data;
        const lower = searchQuery.toLowerCase();
        return data.filter(item =>
            Object.values(item as any).some(val =>
                String(val).toLowerCase().includes(lower)
            )
        );
    }, [data, searchQuery]);

    // Sort
    const sortedData = React.useMemo(() => {
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    if (isLoading && data.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 flex justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-garabandal-gold border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); if (onSearch) onSearch(e.target.value); }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 transition-colors w-full justify-center sm:w-auto">
                        <Filter className="w-4 h-4" />
                        Filtros
                    </button>
                    {/* Additional toolbar actions passed as children could go here */}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                    className={`px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:bg-gray-50 select-none' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                                >
                                    <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                        {col.header}
                                        {col.sortable && (
                                            <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === col.key ? 'text-garabandal-gold' : 'text-gray-300'}`} />
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs text-right">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {paginatedData.length > 0 ? (
                            paginatedData.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => onRowClick && onRowClick(item)}
                                    className={`hover:bg-gray-50/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                >
                                    {columns.map((col) => (
                                        <td key={`${item.id}-${col.key}`} className={`px-6 py-4 whitespace-nowrap text-gray-700 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                            {col.render ? col.render(item) : (item as any)[col.key]}
                                        </td>
                                    ))}
                                    {actions && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                            {actions(item)}
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-gray-400">
                                    Nenhum resultado encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        A mostrar <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedData.length)}</span> de <span className="font-medium">{sortedData.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium px-2">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
