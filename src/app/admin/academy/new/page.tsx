"use client";

import { useState } from 'react';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { Save, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewCoursePage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [loading, setLoading] = useState(false);

    // Auto-generate slug from title
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTitle(val);
        setSlug(val.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanum with dash
            .replace(/^-+|-+$/g, '') // trim dashes
        );
    };

    const handleCreate = async () => {
        if (!title || !slug) return;
        setLoading(true);

        const { data, error } = await supabaseBrowser
            .from('academy_courses')
            .insert({
                title,
                slug,
                description: 'Nova descrição...',
                published: false,
                price: 0
            })
            .select()
            .single();

        if (error) {
            alert("Erro: " + error.message);
            setLoading(false);
        } else {
            router.push(`/admin/academy/${data.id}`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
                <Link href="/admin/academy" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-6">
                    <ChevronLeft className="w-4 h-4" /> Cancelar
                </Link>

                <h1 className="text-2xl font-bold text-slate-900 mb-6">Novo Curso</h1>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Curso</label>
                        <input
                            value={title}
                            onChange={handleTitleChange}
                            className="w-full p-3 border border-slate-300 rounded-lg font-bold text-lg"
                            placeholder="Ex: Teologia de Garabandal"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL Slug</label>
                        <input
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 font-mono text-sm"
                            placeholder="ex: teologia-de-garabandal"
                        />
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={loading || !title}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                        {loading ? 'Criando...' : 'Criar e Continuar'} <Save className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
