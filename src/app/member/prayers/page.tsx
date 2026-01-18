"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import VIPLayout from '../../../components/member/VIPLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, BookOpen, Star, Heart, X, ChevronRight, ArrowLeft } from 'lucide-react';

// --- DATA ---
// --- DATA ---
type Prayer = {
    id: string;
    title: string;
    category: string;
    preview: string;
    image_url?: string;
    content: string;
    published?: boolean;
};

export default function PrayersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPrayer, setSelectedPrayer] = useState<Prayer | null>(null);
    const [filter, setFilter] = useState('Todas');
    const [prayers, setPrayers] = useState<Prayer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPrayers();
    }, []);

    const loadPrayers = async () => {
        // Fetch from Supabase
        const { supabaseBrowser } = await import('../../../lib/supabase-browser');
        if (!supabaseBrowser) return;

        // Only fetch published prayers
        const { data, error } = await supabaseBrowser
            .from('prayers')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });

        if (data) {
            setPrayers(data);
        }
        setLoading(false);
    };

    // Categories logic
    const categories = ['Todas', ...Array.from(new Set(prayers.map(p => p.category)))];

    // Filter logic
    const filteredPrayers = prayers.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filter === 'Todas' || p.category === filter;
        return matchesSearch && matchesCategory;
    });

    return (
        <VIPLayout>
            <div className="max-w-6xl mx-auto pb-20 px-4 md:px-0">
                {/* Navigation Back */}
                <div className="pt-6 mb-8">
                    <Link href="/member" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Voltar à Área de Membro</span>
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium mb-6"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Espiritualidade e Devoção</span>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-serif font-bold text-white mb-6"
                    >
                        Tesouro de Orações
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
                    >
                        Encontra a paz e a força espiritual através destas orações selecionadas para a tua caminhada de fé.
                    </motion.p>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-12 sticky top-24 z-30 bg-slate-950/80 backdrop-blur-xl p-4 rounded-2xl border border-white/5 shadow-2xl">
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filter === cat
                                    ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/40'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Procurar oração..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500/50 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPrayers.map((prayer, index) => (
                        <motion.div
                            key={prayer.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => setSelectedPrayer(prayer)}
                            className="group cursor-pointer bg-slate-900 border border-white/5 rounded-2xl overflow-hidden relative min-h-[300px] flex flex-col hover:shadow-2xl hover:shadow-yellow-900/40 transition-shadow"
                        >
                            {/* Background Image with Overlay */}
                            <div className="absolute inset-0 z-0">
                                {/* Image */}
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                    style={{ backgroundImage: `url('${prayer.image_url || '/images/meninasgarabandal.jpg'}')` }}
                                />
                                {/* Gradient Overlay for readability - Strong blend */}
                                <div className="absolute inset-0 bg-slate-950/80 group-hover:bg-slate-950/70 transition-colors" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent opacity-100" />
                            </div>

                            {/* Content */}
                            <div className="relative z-10 p-6 flex flex-col h-full">
                                <div className="mb-4">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-2 block drop-shadow-md">{prayer.category}</span>
                                    <h3 className="text-xl font-serif font-bold text-white group-hover:text-yellow-400 transition-colors drop-shadow">{prayer.title}</h3>
                                </div>

                                <p className="text-slate-300 text-sm line-clamp-3 mb-6 font-serif italic opacity-90 leading-relaxed drop-shadow-sm">
                                    "{prayer.preview}"
                                </p>

                                <div className="mt-auto flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" /> Ler Oração
                                    </span>
                                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-slate-900 transition-all border border-white/10">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Empty State */}
                {filteredPrayers.length === 0 && (
                    <div className="text-center py-20">
                        <Star className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500">Nenhuma oração encontrada.</p>
                        <button onClick={() => { setFilter('Todas'); setSearchTerm('') }} className="mt-4 text-yellow-500 font-bold hover:underline">
                            Limpar filtros
                        </button>
                    </div>
                )}

                {/* Modal */}
                <AnimatePresence>
                    {selectedPrayer && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedPrayer(null)}
                                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />

                                {/* Modal Header */}
                                <div className="p-6 md:p-8 border-b border-white/5 flex items-start justify-between bg-slate-900/50 backdrop-blur-xl shrink-0 z-10">
                                    <div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-yellow-500 block mb-2">{selectedPrayer.category}</span>
                                        <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">{selectedPrayer.title}</h2>
                                    </div>
                                    <button
                                        onClick={() => setSelectedPrayer(null)}
                                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Content - Scrollable */}
                                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                                    <div className="prose prose-invert prose-lg max-w-none">
                                        <div className="text-center font-serif text-slate-200 leading-loose whitespace-pre-line">
                                            {selectedPrayer.content}
                                        </div>
                                    </div>

                                    <div className="mt-12 flex justify-center">
                                        <Heart className="w-6 h-6 text-red-500/50 animate-pulse" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </VIPLayout>
    );
}
