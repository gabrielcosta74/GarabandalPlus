'use client';

import React from 'react';
import { Filter } from 'lucide-react';

interface FilterBarProps {
    categories: string[];
    activeCategory: string;
    onSetCategory: (cat: string) => void;
    activeType: 'all' | 'physical' | 'digital';
    onSetType: (type: 'all' | 'physical' | 'digital') => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
    categories,
    activeCategory,
    onSetCategory,
    activeType,
    onSetType
}) => {
    return (
        <div className="sticky top-20 z-30 py-6 bg-garabandal-mist/95 backdrop-blur-xl border-b border-gray-200 mb-12 shadow-sm">
            <div className="container mx-auto px-6 flex flex-col md:flex-row md:items-center justify-between gap-6">

                {/* Categories */}
                <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider font-bold mr-2">
                        <Filter size={14} />
                        <span>Filtros</span>
                    </div>

                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => onSetCategory(cat)}
                            className={`
                        px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300
                        ${activeCategory === cat
                                    ? 'bg-garabandal-dark text-white shadow-lg shadow-garabandal-dark/20'
                                    : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 shadow-sm'
                                }
                    `}
                        >
                            {cat === 'all' ? 'Todos' : cat}
                        </button>
                    ))}
                </div>

                {/* Types */}
                <div className="flex items-center bg-gray-200/50 rounded-full p-1 border border-gray-200">
                    {[
                        { id: 'all', label: 'Tudo' },
                        { id: 'physical', label: 'Físico' },
                        { id: 'digital', label: 'Digital' },
                    ].map((type) => (
                        <button
                            key={type.id}
                            onClick={() => onSetType(type.id as any)}
                            className={`
                        px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all
                        ${activeType === type.id
                                    ? 'bg-white text-garabandal-dark shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800'
                                }
                    `}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default FilterBar;
