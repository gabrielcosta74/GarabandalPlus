"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Plus, Search, Edit, Trash2, BookOpen, Eye, EyeOff } from 'lucide-react';
import AdminLayout from '../../../components/admin/AdminLayout';

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

    const handleDelete = async (id: string) => {
        if (!confirm('Tem a certeza? Isto apagará a novena e todos os dias associados.')) return;

        if (!supabaseBrowser) return;
        await supabaseBrowser.from('novenas').delete().eq('id', id);
        loadNovenas();
    };

    const togglePublish = async (novena: any) => {
        if (!supabaseBrowser) return;

        await supabaseBrowser
            .from('novenas')
            .update({ published: !novena.published })
            .eq('id', novena.id);

        loadNovenas();
    };

    const filtered = novenas.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout title="Novenas">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Novenas</h1>
                        <p className="text-gray-500">Gestão de jornadas de oração</p>
                    </div>
                    <Link
                        href="/admin/novenas/new"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Novena
                    </Link>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar novenas..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500">A carregar...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Nenhuma novena encontrada</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filtered.map(novena => (
                            <div key={novena.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:border-indigo-500/30 transition-all">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                    {novena.image_url ? (
                                        <img src={novena.image_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <BookOpen className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-gray-900">{novena.title}</h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${novena.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {novena.published ? 'Publicado' : 'Rascunho'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-1">{novena.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => togglePublish(novena)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title={novena.published ? "Despublicar" : "Publicar"}
                                    >
                                        {novena.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <Link
                                        href={`/admin/novenas/${novena.id}`}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(novena.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
