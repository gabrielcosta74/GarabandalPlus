"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Plus, Search, Edit3, Trash2, BookOpen, Eye, EyeOff, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';

export default function AdminNovenasPage() {
    const [novenas, setNovenas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadNovenas();
    }, []);

    const loadNovenas = async () => {
        setLoading(true);
        if (!supabaseBrowser) return;

        const { data, error } = await supabaseBrowser
            .from('novenas')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setNovenas(data);
        setLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Tem a certeza? Isto apagará a novena e todos os dias associados.')) return;

        if (!supabaseBrowser) return;
        await supabaseBrowser.from('novenas').delete().eq('id', id);
        toast.success("Novena apagada com sucesso");
        loadNovenas();
    };

    const togglePublish = async (novena: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!supabaseBrowser) return;

        const newStatus = !novena.published;
        await supabaseBrowser
            .from('novenas')
            .update({ published: newStatus })
            .eq('id', novena.id);

        toast.success(newStatus ? "Novena publicada" : "Novena retirada");
        loadNovenas();
    };

    const filtered = novenas.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <AdminLayout title="Novenas" hideHeader={true}>
            <Toaster position="bottom-right" />
            <div className="bg-slate-50 min-h-screen pb-20">
                {/* Header Section */}
                <div className="bg-white border-b border-slate-200 px-6 py-8 md:py-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <Sparkles className="w-64 h-64 text-indigo-600" />
                    </div>

                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                                <span className="bg-indigo-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-100">
                                    Conteúdo Espiritual
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
                                Novenas e Orações
                            </h1>
                            <p className="text-slate-500 mt-2 text-lg max-w-xl leading-relaxed">
                                Gerencie as jornadas de oração disponíveis para a comunidade.
                            </p>
                        </div>

                        <Link
                            href="/admin/novenas/new"
                            className="bg-indigo-600 text-white pl-4 pr-6 py-3 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 active:scale-95 flex items-center gap-2 group"
                        >
                            <div className="bg-white/20 p-1 rounded-lg">
                                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                            </div>
                            Criar Nova Novena
                        </Link>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                    {/* Search Bar */}
                    <div className="relative max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Pesquisar por título..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm shadow-sm transition-all"
                        />
                    </div>

                    {/* Grid Content */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white rounded-2xl h-[300px] animate-pulse border border-slate-100" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm"
                        >
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <BookOpen className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Sem novenas encontradas</h3>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                Não encontramos resultados para "{searchTerm}". Tente outro termo ou crie uma nova novena.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {filtered.map(novena => (
                                <motion.div variants={itemVariants} key={novena.id}>
                                    <Link href={`/admin/novenas/${novena.id}`} className="group block h-full">
                                        <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col relative">

                                            {/* Status Badge */}
                                            <div className="absolute top-4 left-4 z-10">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm border ${novena.published
                                                        ? 'bg-emerald-500/90 text-white border-emerald-400'
                                                        : 'bg-slate-500/90 text-white border-slate-400'
                                                    }`}>
                                                    {novena.published ? 'Publicada' : 'Rascunho'}
                                                </span>
                                            </div>

                                            {/* Image Section */}
                                            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                                {novena.image_url ? (
                                                    <img
                                                        src={novena.image_url}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                        alt={novena.title}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50 group-hover:bg-indigo-50/30 transition-colors">
                                                        <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                                        <span className="text-xs font-medium uppercase tracking-widest">Sem Capa</span>
                                                    </div>
                                                )}

                                                {/* Hover Overlay */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                            </div>

                                            {/* Content Section */}
                                            <div className="p-6 flex-1 flex flex-col">
                                                <div className="mb-4">
                                                    <h3 className="text-xl font-serif font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-2">
                                                        {novena.title}
                                                    </h3>
                                                    <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed h-[2.5em]">
                                                        {novena.description || 'Sem descrição...'}
                                                    </p>
                                                </div>

                                                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between gap-2">
                                                    <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-500 uppercase tracking-wider transition-colors">
                                                        Editar Detalhes
                                                    </span>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                                        <button
                                                            onClick={(e) => togglePublish(novena, e)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title={novena.published ? "Despublicar" : "Publicar"}
                                                        >
                                                            {novena.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(novena.id, e)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Apagar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
