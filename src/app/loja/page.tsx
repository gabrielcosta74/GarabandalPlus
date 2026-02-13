"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, Filter, X } from 'lucide-react';
import ProductCard from '../../components/store/ProductCard';
import { Product } from '../loja-online/data';
import { buildProductPath } from '../../lib/slug';
import { inferIsDigitalProduct } from '../../lib/product-kind';

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

    const isDigitalProduct = (product: Product) => {
        return inferIsDigitalProduct({
            isPhysical: (product as any).isPhysical,
            typeId: (product as any).type_id,
            category: (product as any).category,
            name: product.name,
            digitalUrl: (product as any).digitalUrl,
        });
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch(`/api/store/products?includeVariants=0&t=${Date.now()}`, {
                cache: 'no-store'
            });
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
                matchesCategory = isDigitalProduct(product);
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 md:pb-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-8">
                        <div className="max-w-2xl mx-auto">
                            <h1 className="text-3xl md:text-5xl font-serif font-bold text-white tracking-tight mb-4">
                                Loja Online
                            </h1>
                            <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                                Encontre livros, terços e materiais de formação do Apostolado.
                            </p>
                        </div>

                        {/* Payment Cards Integration - Centered & Larger */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 w-full max-w-3xl mx-auto transform hover:scale-[1.01] transition-all duration-300">
                            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                                Pagamentos 100% Seguros
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                                {/* MULTIBANCO */}
                                <div className="bg-white h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity shadow-lg" title="Multibanco">
                                    <img src="/payment-icons/multibanco.svg" alt="Multibanco" className="h-5 md:h-6 w-auto" />
                                </div>
                                {/* MB WAY */}
                                <div className="bg-white h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity shadow-lg" title="MB WAY">
                                    <img src="/payment-icons/mbway.svg" alt="MB Way" className="h-5 md:h-6 w-auto" />
                                </div>
                                {/* VISA */}
                                <div className="bg-white h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity shadow-lg" title="Visa">
                                    <img src="/payment-icons/visa.svg" alt="Visa" className="h-3 md:h-4 w-auto" />
                                </div>
                                {/* MASTERCARD */}
                                <div className="bg-white h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity shadow-lg" title="Mastercard">
                                    <img src="/payment-icons/mastercard.svg" alt="Mastercard" className="h-6 md:h-8 w-auto" />
                                </div>
                                {/* PIX - HIGHLIGHT */}
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
                                    <div className="relative bg-slate-900 border border-white/10 h-10 md:h-12 px-4 md:px-6 rounded-lg flex items-center gap-3">
                                        <img src="/payment-icons/pix-original.png" alt="PIX" className="h-5 md:h-6 w-auto" />
                                        <span className="text-xs md:text-sm font-bold text-white whitespace-nowrap">Brasil 🇧🇷</span>
                                    </div>
                                </div>
                            </div>
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
