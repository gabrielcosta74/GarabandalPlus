"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import AdminLayout from '../../../../components/admin/AdminLayout';
import CategoryManager from '../../../../components/admin/CategoryManager';
import { ArrowLeft, Loader2, Save, Upload, X, Settings } from 'lucide-react';
import Link from 'next/link';

type CategoryType = {
    id: string;
    name: string;
};

export default function NewPrayerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('');
    const [preview, setPreview] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [published, setPublished] = useState(false);

    // Categories State
    const [dbCategories, setDbCategories] = useState<CategoryType[]>([]);
    const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        if (!supabaseBrowser) return;
        const { data } = await supabaseBrowser
            .from('prayer_categories')
            .select('id, name')
            .order('name');

        if (data) setDbCategories(data);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        try {
            setUploading(true);
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `prayers/${fileName}`;

            if (!supabaseBrowser) throw new Error('Supabase client not initialized');

            const { error: uploadError } = await supabaseBrowser.storage
                .from('prayer-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabaseBrowser.storage
                .from('prayer-assets')
                .getPublicUrl(filePath);

            setImageUrl(data.publicUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Erro ao carregar imagem.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !category || !content) return;

        setLoading(true);
        try {
            if (!supabaseBrowser) throw new Error('Supabase client not initialized');

            const slug = title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');

            const { error } = await supabaseBrowser.from('prayers').insert({
                title,
                slug: `${slug}-${Date.now()}`, // Ensure uniqueness
                category,
                content,
                preview: preview || content.substring(0, 100) + '...',
                image_url: imageUrl,
                published
            });

            if (error) throw error;
            router.push('/admin/prayers');
        } catch (error) {
            console.error('Error creating prayer:', error);
            alert('Erro ao criar oração.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/prayers" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Nova Oração</h1>
                            <p className="text-slate-500">Adicionar uma nova oração ao tesouro espiritual.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/prayers" className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Criar Oração
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none"
                                    placeholder="Ex: Avé Maria"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pré-visualização (Resumo)</label>
                                <textarea
                                    value={preview}
                                    onChange={e => setPreview(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none h-24 resize-none"
                                    placeholder="Breve resumo que aparece no cartão..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo da Oração</label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none h-96 font-serif text-lg leading-relaxed"
                                    placeholder="Texto completo da oração..."
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-2">Suporta quebras de linha para estrofes.</p>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Publishing */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Publicação</h3>
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={published}
                                    onChange={e => setPublished(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                />
                                <span className="text-sm font-medium text-slate-700">Publicar imediatamente</span>
                            </label>
                        </div>

                        {/* Category */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900">Categoria</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsCatManagerOpen(true)}
                                    className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                    <Settings className="w-3 h-3" /> Gerir
                                </button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {dbCategories.map(cat => (
                                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer p-1 hover:bg-slate-50 rounded">
                                        <input
                                            type="radio"
                                            name="category"
                                            value={cat.name}
                                            checked={category === cat.name}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-4 h-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                                        />
                                        <span className="text-sm text-slate-700">{cat.name}</span>
                                    </label>
                                ))}
                                {dbCategories.length === 0 && (
                                    <p className="text-sm text-slate-400 italic">Sem categorias. Adicione uma.</p>
                                )}
                            </div>
                        </div>

                        {/* Image */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Imagem de Fundo</h3>

                            {imageUrl ? (
                                <div className="relative group rounded-lg overflow-hidden aspect-video">
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl('')}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-slate-400 transition-colors bg-slate-50/50">
                                    {uploading ? (
                                        <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500 mb-4">Arraste ou clique para carregar</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-slate-400 mt-2">Recomendado: 1920x1080px (Unsplash ou Upload)</p>
                        </div>
                    </div>
                </div>
            </form>

            <CategoryManager
                isOpen={isCatManagerOpen}
                onClose={() => setIsCatManagerOpen(false)}
                onUpdate={loadCategories}
            />
        </AdminLayout>
    );
}
