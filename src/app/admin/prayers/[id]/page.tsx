"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import AdminLayout from '../../../../components/admin/AdminLayout';
import CategoryManager from '../../../../components/admin/CategoryManager';
import { ArrowLeft, Loader2, Save, Upload, X, Trash2, Settings, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import ImageCropper from '../../../../components/admin/ImageCropper';

type CategoryType = {
    id: string;
    name: string;
};

export default function EditPrayerPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('');
    const [preview, setPreview] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [published, setPublished] = useState(false);

    // Cropper State
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);

    // Categories
    const [dbCategories, setDbCategories] = useState<CategoryType[]>([]);
    const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);

    useEffect(() => {
        loadPrayer();
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

    const loadPrayer = async () => {
        if (!supabaseBrowser) return;

        const { data } = await supabaseBrowser
            .from('prayers')
            .select('*')
            .eq('id', params.id)
            .single();

        if (!data) {
            alert('Oração não encontrada');
            router.push('/admin/prayers');
            return;
        }

        setTitle(data.title);
        setCategory(data.category);
        setContent(data.content);
        setPreview(data.preview || '');
        setImageUrl(data.image_url || '');
        setPublished(data.published);
        setLoading(false);
    };

    // 1. Select Image -> Open Cropper
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageToCrop(reader.result?.toString() || null);
        });
        reader.readAsDataURL(file);
    };

    // 2. Save Cropped Image -> Upload to Supabase
    const handleCropSave = async (croppedFile: File) => {
        if (!supabaseBrowser) return;
        setSaving(true);
        setImageToCrop(null); // Close modal

        try {
            const fileExt = croppedFile.name.split('.').pop() || 'jpeg';
            const fileName = `prayers/${params.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabaseBrowser.storage
                .from('prayer-assets')
                .upload(fileName, croppedFile);

            if (uploadError) throw uploadError;

            const { data } = supabaseBrowser.storage
                .from('prayer-assets')
                .getPublicUrl(fileName);

            setImageUrl(data.publicUrl);
        } catch (error) {
            console.error('Error uploading cropped image:', error);
            alert('Erro ao carregar imagem recortada.');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !category || !content) return;

        setSaving(true);
        try {
            if (!supabaseBrowser) throw new Error('Supabase client not initialized');

            const { error } = await supabaseBrowser
                .from('prayers')
                .update({
                    title,
                    category,
                    content,
                    preview: preview || content.substring(0, 100) + '...',
                    image_url: imageUrl,
                    published,
                    updated_at: new Date().toISOString()
                })
                .eq('id', params.id);

            if (error) throw error;
            router.push('/admin/prayers');
        } catch (error) {
            console.error('Error updating prayer:', error);
            alert('Erro ao atualizar oração.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-gray-50/95 backdrop-blur z-30 py-4 -mx-4 px-4 md:mx-0 md:px-0 border-b border-gray-200 md:border-none md:bg-transparent md:backdrop-filter-none">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/prayers" className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Editar Oração</h1>
                            <p className="text-slate-500 text-sm">Editar detalhes da oração.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Link href="/admin/prayers" className="flex-1 md:flex-none text-center px-4 py-3 md:py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors bg-white border border-gray-200 md:border-transparent md:bg-transparent">
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-slate-900 text-white px-6 py-3 md:py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
                        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-4 py-3 md:py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none"
                                    placeholder="Ex: Avé Maria"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pré-visualização</label>
                                <textarea
                                    value={preview}
                                    onChange={e => setPreview(e.target.value)}
                                    className="w-full px-4 py-3 md:py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none h-24 resize-none"
                                    placeholder="Breve resumo..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo da Oração</label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    className="w-full px-4 py-3 md:py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none h-[400px] md:h-96 font-serif text-lg leading-relaxed"
                                    placeholder="Texto completo da oração..."
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6 order-1 lg:order-2">
                        {/* Publishing */}
                        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Publicação</h3>
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors tap-highlight-transparent">
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
                        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900">Categoria</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsCatManagerOpen(true)}
                                    className="text-xs flex items-center gap-1 text-blue-600 hover:underline p-2 -mr-2"
                                >
                                    <Settings className="w-3 h-3" /> Gerir
                                </button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {dbCategories.map(cat => (
                                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded tap-highlight-transparent">
                                        <input
                                            type="radio"
                                            name="category"
                                            value={cat.name}
                                            checked={category === cat.name}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-5 h-5 md:w-4 md:h-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                                        />
                                        <span className="text-sm text-slate-700">{cat.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Image with Cropper Trigger */}
                        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Imagem de Fundo</h3>

                            {imageUrl ? (
                                <div className="space-y-3">
                                    <div className="relative group rounded-lg overflow-hidden aspect-[3/4] border border-slate-100">
                                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <label className="cursor-pointer px-4 py-2 bg-white rounded-lg text-sm font-bold text-gray-900 hover:bg-gray-100 shadow-lg">
                                                Alterar
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                                            </label>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl('')}
                                        className="text-xs text-red-500 hover:text-red-600 w-full text-center"
                                    >
                                        Remover Imagem
                                    </button>
                                </div>
                            ) : (
                                <div className="relative border-2 border-dashed border-slate-200 rounded-lg p-6 md:p-8 text-center hover:border-slate-400 transition-colors bg-slate-50/50 aspect-[3/4] flex flex-col items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-slate-300 mb-3" />
                                    <p className="text-sm text-slate-500 mb-1 font-bold">Carregar Imagem</p>
                                    <p className="text-xs text-slate-400 mb-4">Recomendado: 3:4 Vertical</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <CategoryManager
                    isOpen={isCatManagerOpen}
                    onClose={() => setIsCatManagerOpen(false)}
                    onUpdate={loadCategories}
                />

                {/* Cropper Modal */}
                {imageToCrop && (
                    <ImageCropper
                        imageSrc={imageToCrop}
                        aspect={3 / 4} // Vertical for prayers too? Or keep landscape? User asked for "same system", usually means cards. Novenas use 3:4. Let's use 3:4 for consistency with mobile cards, or make it adjustable. 3:4 is better for mobile cards.
                        onCropComplete={handleCropSave}
                        onCancel={() => setImageToCrop(null)}
                    />
                )}
            </form>
        </AdminLayout>
    );
}
