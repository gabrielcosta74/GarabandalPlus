"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import AdminLayout from '../../../../components/admin/AdminLayout';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function NewNovenaPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        description: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!supabaseBrowser) {
            setLoading(false);
            return;
        }

        // Auto-generate slug if empty
        let finalSlug = formData.slug;
        if (!finalSlug) {
            finalSlug = formData.title
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }

        const { data, error } = await supabaseBrowser
            .from('novenas')
            .insert({
                title: formData.title,
                slug: finalSlug,
                description: formData.description,
                published: false
            })
            .select()
            .single();

        if (error) {
            alert('Erro ao criar novena: ' + error.message);
            setLoading(false);
        } else {
            router.push(`/admin/novenas/${data.id}`);
        }
    };

    return (
        <AdminLayout title="Nova Novena">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/novenas" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Nova Novena</h1>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título da Novena</label>
                            <input
                                required
                                type="text"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="ex: Novena a N. Sra. do Carmo"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL amigável)</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-gray-50 text-gray-500 font-mono text-sm"
                                value={formData.slug}
                                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                placeholder="gerado-automaticamente"
                            />
                            <p className="text-xs text-gray-400 mt-1">Deixe em branco para gerar automaticamente a partir do título.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta</label>
                            <textarea
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Uma breve descrição sobre o propósito desta novena..."
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Criar e Continuar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
