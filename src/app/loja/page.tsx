"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, Filter, X } from 'lucide-react';
import ProductCard from '../../components/store/ProductCard';
import { Product } from '../loja-online/data';
import { buildProductPath } from '../../lib/slug';

// Categories for filter
// Categories for filter
const CATEGORIES = [
    { id: 'all', label: 'Todos' },
    { id: 'Livro Físico', label: 'Livros' },
    { id: 'Artigo Religioso', label: 'Artigos Religiosos' },
    { id: 'Vestuário', label: 'Vestuário' },
    { id: 'Livro Digital', label: 'Digitais' },
];

export default function StorePage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/store/products?includeVariants=0');
            const data = await res.json();
            setProducts(data.products || []);
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());

            let matchesCategory = false;
            if (selectedCategory === 'all') {
                matchesCategory = true;
            } else if (selectedCategory === 'Livro Físico' || selectedCategory === 'Livros') {
                // Includes Physical and Digital books
                matchesCategory = product.category === 'Livro Físico' ||
                    (product.category ? product.category.includes('Livro') : false) ||
                    (product.type_id ? product.type_id.includes('book') : false);
            } else if (selectedCategory === 'Livro Digital' || selectedCategory === 'Digitais') {
                matchesCategory = product.category === 'Livro Digital' ||
                    product.type === 'digital' ||
                    product.tag === 'Digital' ||
                    product.type_id === 'book_digital';
            } else if (selectedCategory === 'Vestuário') {
                matchesCategory = product.category === 'Vestuário' ||
                    product.type_id === 'clothing';
            } else {
                // Fallback direct match
                matchesCategory = product.category === selectedCategory;
            }

            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategory]);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Compact Store Hero */}
            <div className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12 md:pb-16">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">
                                Loja Online
                            </h1>
                            <p className="mt-2 text-slate-400 text-sm md:text-base max-w-lg">
                                Encontre livros, terços e materiais de formação do Apostolado.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">

                {/* Toolbar */}
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6 mb-12 border border-slate-100">
                    <div className="flex flex-col md:flex-row gap-6 items-center justify-between">

                        {/* Categories */}
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start w-full md:w-auto">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat.id
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Pesquisar artigos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="h-[250px] md:h-[400px] bg-white rounded-xl md:rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-8">
                        <AnimatePresence mode='popLayout'>
                            {filteredProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onClick={() => router.push(buildProductPath(product.id, product.name))}
                                    onAddToCart={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        router.push(buildProductPath(product.id, product.name));
                                    }}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="text-center py-32">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShoppingBag className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">Sem produtos encontrados</h3>
                        <p className="text-slate-500">Tente ajustar a pesquisa ou os filtros.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
