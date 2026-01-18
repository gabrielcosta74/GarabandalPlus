"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import AdminLayout from '../../../components/admin/AdminLayout';
import { Plus, Search, Edit, Trash2, BookOpen, MoreVertical, Calendar } from 'lucide-react';

type Prayer = {
    id: string;
    title: string;
    category: string;
    published: boolean;
    created_at: string;
    preview: string;
    image_url?: string | null;
};

export default function AdminPrayersPage() {
    const [prayers, setPrayers] = useState<Prayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadPrayers();
    }, []);

    const loadPrayers = async () => {
        if (!supabaseBrowser) return;

        const { data } = await supabaseBrowser
            .from('prayers')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setPrayers(data);
        setLoading(false);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // Stop propagation if clicked within a link
        e.stopPropagation();
        if (!confirm('Tem a certeza que deseja eliminar esta oração?')) return;
        if (!supabaseBrowser) return;

        await supabaseBrowser.from('prayers').delete().eq('id', id);
        loadPrayers();
    };

    const filteredPrayers = prayers.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Orações</h1>
                        <p className="text-slate-500">Gerir todas as orações e devoções.</p>
                    </div>
                    <Link
                        href="/admin/prayers/new"
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 md:py-2 rounded-xl hover:bg-slate-800 transition-colors font-medium shadow-lg shadow-slate-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Oração
                    </Link>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Procurar orações por título ou categoria..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white shadow-sm"
                    />
                </div>

                {/* Content */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
                            <p>A carregar orações...</p>
                        </div>
                    ) : filteredPrayers.length === 0 ? (
                        <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                <BookOpen className="w-8 h-8 text-slate-300" />
                            </div>
                            <div>
                                <h3 className="text-slate-900 font-bold mb-1">Nenhuma oração encontrada</h3>
                                <p className="text-sm">Tente refazer a pesquisa ou crie uma nova.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-4 w-20">Imagem</th>
                                            <th className="px-6 py-4">Título</th>
                                            <th className="px-6 py-4">Categoria</th>
                                            <th className="px-6 py-4">Estado</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredPrayers.map((prayer) => (
                                            <tr key={prayer.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative">
                                                        {prayer.image_url ? (
                                                            <img src={prayer.image_url} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                <BookOpen className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-slate-900 block mb-0.5">{prayer.title}</span>
                                                    <span className="text-xs text-slate-400 font-mono truncate max-w-[200px] block">{prayer.preview}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider border border-slate-200">
                                                        {prayer.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <StatusBadge published={prayer.published} />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Link
                                                            href={`/admin/prayers/${prayer.id}`}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors tooltip"
                                                            title="Editar"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Link>
                                                        <button
                                                            onClick={(e) => handleDelete(e, prayer.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors tooltip"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {filteredPrayers.map((prayer) => (
                                    <Link
                                        href={`/admin/prayers/${prayer.id}`}
                                        key={prayer.id}
                                        className="flex gap-4 p-4 active:bg-slate-50 transition-colors relative"
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-20 h-24 shrink-0 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative">
                                            {prayer.image_url ? (
                                                <img src={prayer.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <BookOpen className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-2">{prayer.title}</h3>
                                                    <button
                                                        onClick={(e) => handleDelete(e, prayer.id)}
                                                        className="p-2 -mr-2 -mt-2 text-slate-300 hover:text-red-500 transition-colors z-10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <StatusBadge published={prayer.published} compact />
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                        {prayer.category}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                {prayer.preview || "Sem pré-visualização..."}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatusBadge({ published, compact }: { published: boolean, compact?: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${published
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {!compact && (published ? 'Publicado' : 'Rascunho')}
        </span>
    );
}
