"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import AdminLayout from '../../../components/admin/AdminLayout';
import BilingualField, {
    BilingualListField,
    TranslateAllButton,
} from '../../../components/admin/BilingualField';
import ImageUpload from '../../../components/admin/ImageUpload';
import { Toaster, toast } from 'sonner';
import {
    BANK_TRANSFER_SITE_CONTENT_KEY,
    DEFAULT_BANK_TRANSFER_DETAILS,
    normalizeBankTransferDetails,
    type BankTransferDetails,
} from '../../../lib/bank-transfer-details';
import {
    Save,
    Bus,
    Hotel,
    List,
    Landmark,
    MessageSquare,
    Plus,
    Trash2,
    Edit2,
    X,
    ChevronRight,
    Loader2,
    Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GlobalLogistics = {
    transport_title: string;
    transport_title_en?: string;
    transport_description: string;
    transport_description_en?: string;
    transport_image: string;
    accommodation_rating: string;
    accommodation_rating_en?: string;
    accommodation_description: string;
    accommodation_description_en?: string;
    accommodation_image: string;
    included_items: string[];
    included_items_en?: string[];
    not_included_items: string[];
    not_included_items_en?: string[];
};

type Testimonial = {
    id?: string;
    author_name: string;
    role: string;
    role_en?: string | null;
    text: string;
    text_en?: string | null;
    image_url: string;
    display_order: number;
};

const DEFAULT_LOGISTICS: GlobalLogistics = {
    transport_title: '',
    transport_title_en: '',
    transport_description: '',
    transport_description_en: '',
    transport_image: '',
    accommodation_rating: '',
    accommodation_rating_en: '',
    accommodation_description: '',
    accommodation_description_en: '',
    accommodation_image: '',
    included_items: [],
    included_items_en: [],
    not_included_items: [],
    not_included_items_en: []
};

export default function GlobalContentPage() {
    const [activeSection, setActiveSection] = useState<'logistics' | 'testimonials' | 'gallery' | 'banking'>('gallery');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Logistics State
    const [logistics, setLogistics] = useState<GlobalLogistics>(DEFAULT_LOGISTICS);
    const [bankDetails, setBankDetails] = useState<BankTransferDetails>(DEFAULT_BANK_TRANSFER_DETAILS);

    // Testimonials State
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);

    // Gallery State
    type GalleryImage = {
        id: string;
        image_url: string;
        display_order: number;
        is_active: boolean;
        created_at: string;
    };
    const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);

    useEffect(() => {
        fetchContent();
    }, []);

    const fetchContent = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);

        // 1. Fetch Logistics (from site_content)
        const { data: cData } = await supabaseBrowser
            .from('site_content')
            .select('*')
            .in('key', ['logistics_global', BANK_TRANSFER_SITE_CONTENT_KEY]);

        if (cData && cData.length > 0) {
            const logisticsRow = cData.find((row: any) => row.key === 'logistics_global');
            const bankDetailsRow = cData.find((row: any) => row.key === BANK_TRANSFER_SITE_CONTENT_KEY);

            if (logisticsRow?.content) setLogistics({ ...DEFAULT_LOGISTICS, ...logisticsRow.content });
            if (bankDetailsRow?.content) setBankDetails(normalizeBankTransferDetails(bankDetailsRow.content));
        }

        // 2. Fetch Testimonials
        const { data: tData } = await supabaseBrowser
            .from('testimonials')
            .select('*')
            .order('display_order');

        if (tData) setTestimonials(tData);

        // 3. Fetch Gallery
        const { data: gData } = await supabaseBrowser
            .from('gallery_images')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (gData) setGalleryImages(gData);

        setLoading(false);
    };

    const saveLogistics = async () => {
        if (!supabaseBrowser) {
            toast.error('Erro de configuração: cliente Supabase indisponível.');
            return;
        }
        setSaving(true);

        try {
            const { error } = await supabaseBrowser
                .from('site_content')
                .upsert([
                    {
                        key: 'logistics_global',
                        content: logistics,
                        updated_at: new Date().toISOString()
                    },
                    {
                        key: BANK_TRANSFER_SITE_CONTENT_KEY,
                        content: bankDetails,
                        updated_at: new Date().toISOString()
                    }
                ]);

            if (error) {
                toast.error(`Erro ao guardar alterações: ${error.message}`);
                return;
            }

            toast.success('Alterações guardadas com sucesso.');
        } catch (err: any) {
            toast.error(`Erro inesperado ao guardar: ${err?.message || 'erro desconhecido'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTestimonial = async () => {
        if (!supabaseBrowser || !editingTestimonial) return;
        setSaving(true);

        const { data, error } = await supabaseBrowser
            .from('testimonials')
            .upsert(editingTestimonial)
            .select()
            .single();

        if (error) {
            toast.error('Erro ao guardar testemunho: ' + error.message);
        } else if (data) {
            // Update local list
            setTestimonials(prev => {
                const index = prev.findIndex(t => t.id === data.id);
                if (index >= 0) {
                    const newStats = [...prev];
                    newStats[index] = data;
                    return newStats;
                }
                return [...prev, data];
            });
            setEditingTestimonial(null);
            toast.success('Testemunho guardado com sucesso.');
        }
        setSaving(false);
    };

    const handleDeleteTestimonial = async (id: string) => {
        if (!supabaseBrowser) return;
        if (!confirm('Tem a certeza que quer apagar este testemunho?')) return;

        const { error } = await supabaseBrowser.from('testimonials').delete().eq('id', id);

        if (error) {
            toast.error('Erro ao apagar: ' + error.message);
        } else {
            setTestimonials(prev => prev.filter(t => t.id !== id));
            if (editingTestimonial?.id === id) setEditingTestimonial(null);
            toast.success('Testemunho apagado com sucesso.');
        }
    };

    const startNewTestimonial = () => {
        setEditingTestimonial({
            author_name: '',
            role: '',
            role_en: '',
            text: '',
            text_en: '',
            image_url: '',
            display_order: testimonials.length + 1
        });
    };

    // Gallery Handlers
    const handleGalleryImageAdded = async (url: string) => {
        if (!url || !supabaseBrowser) return;

        const { data, error } = await supabaseBrowser
            .from('gallery_images')
            .insert({
                image_url: url,
                display_order: galleryImages.length + 1,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            toast.error('Erro ao adicionar imagem: ' + error.message);
        } else if (data) {
            setGalleryImages([data, ...galleryImages]); // Add to top
            toast.success('Imagem adicionada à galeria');
        }
    };

    const handleDeleteGalleryImage = async (id: string) => {
        if (!supabaseBrowser) return;
        if (!confirm('Tem a certeza que quer remover esta imagem?')) return;

        const { error } = await supabaseBrowser
            .from('gallery_images')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Erro ao remover imagem');
        } else {
            setGalleryImages(prev => prev.filter(img => img.id !== id));
            toast.success('Imagem removida');
        }
    };

    const toggleGalleryImageActive = async (image: GalleryImage) => {
        if (!supabaseBrowser) return;
        const newVal = !image.is_active;

        // Optimistic
        setGalleryImages(prev => prev.map(img => img.id === image.id ? { ...img, is_active: newVal } : img));

        const { error } = await supabaseBrowser
            .from('gallery_images')
            .update({ is_active: newVal })
            .eq('id', image.id);

        if (error) {
            toast.error('Erro ao atualizar estado');
            setGalleryImages(prev => prev.map(img => img.id === image.id ? { ...img, is_active: !newVal } : img));
        }
    };

    return (
        <AdminLayout title="Conteúdo Global" isLoading={loading}>
            <Toaster position="top-right" richColors />
            <div className="flex flex-col lg:flex-row gap-8 pb-20">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-6">

                    {/* GROUP: PILGRIMAGES */}
                    <div className="space-y-2">
                        <div className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Página Peregrinações
                        </div>

                        <button
                            onClick={() => setActiveSection('gallery')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-left font-medium transition-all ${activeSection === 'gallery'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="flex items-center gap-3">
                                <ImageIcon className="w-4 h-4" />
                                Galeria de Fotos
                                <span className={`px-2 py-0.5 rounded text-[10px] ml-auto ${activeSection === 'gallery' ? 'bg-white/20' : 'bg-slate-100'}`}>
                                    {galleryImages.length}
                                </span>
                            </span>
                            {activeSection === 'gallery' && <ChevronRight className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={() => setActiveSection('testimonials')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-left font-medium transition-all ${activeSection === 'testimonials'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="flex items-center gap-3">
                                <MessageSquare className="w-4 h-4" />
                                Testemunhos
                                <span className={`px-2 py-0.5 rounded text-[10px] ml-auto ${activeSection === 'testimonials' ? 'bg-white/20' : 'bg-slate-100'}`}>
                                    {testimonials.length}
                                </span>
                            </span>
                            {activeSection === 'testimonials' && <ChevronRight className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={() => setActiveSection('logistics')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-left font-medium transition-all ${activeSection === 'logistics'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="flex items-center gap-3">
                                <Bus className="w-4 h-4" />
                                Logística Padrão
                            </span>
                            {activeSection === 'logistics' && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* GROUP: GENERAL */}
                    <div className="space-y-2">
                        <div className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Geral
                        </div>
                        <button
                            onClick={() => setActiveSection('banking')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-left font-medium transition-all ${activeSection === 'banking'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="flex items-center gap-3">
                                <Landmark className="w-4 h-4" />
                                Dados Bancários
                            </span>
                            {activeSection === 'banking' && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>

                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">

                    {/* LOGISTICS SECTION */}
                    {activeSection === 'logistics' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold font-serif text-slate-900">Logística Global</h2>
                                <div className="flex items-center gap-3">
                                    <TranslateAllButton
                                        fields={[
                                            { ptValue: logistics.transport_title, onChangeEn: v => setLogistics(current => ({ ...current, transport_title_en: v })) },
                                            { ptValue: logistics.transport_description, onChangeEn: v => setLogistics(current => ({ ...current, transport_description_en: v })) },
                                            { ptValue: logistics.accommodation_rating, onChangeEn: v => setLogistics(current => ({ ...current, accommodation_rating_en: v })) },
                                            { ptValue: logistics.accommodation_description, onChangeEn: v => setLogistics(current => ({ ...current, accommodation_description_en: v })) },
                                            {
                                                ptValue: (logistics.included_items || []).join('\n'),
                                                onChangeEn: v => setLogistics(current => ({
                                                    ...current,
                                                    included_items_en: v.split('\n').map(item => item.trim()).filter(Boolean)
                                                }))
                                            },
                                            {
                                                ptValue: (logistics.not_included_items || []).join('\n'),
                                                onChangeEn: v => setLogistics(current => ({
                                                    ...current,
                                                    not_included_items_en: v.split('\n').map(item => item.trim()).filter(Boolean)
                                                }))
                                            }
                                        ]}
                                    />
                                    <button
                                        onClick={saveLogistics}
                                        disabled={saving}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-900/10 disabled:opacity-50 transition-all"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Guardar Alterações
                                    </button>
                                </div>
                            </div>

                            {/* Transport Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Bus className="w-5 h-5 text-blue-500" />
                                    Transporte
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <BilingualField
                                            label="Título"
                                            ptValue={logistics.transport_title}
                                            enValue={logistics.transport_title_en || ''}
                                            onChangePt={value => setLogistics({ ...logistics, transport_title: value })}
                                            onChangeEn={value => setLogistics({ ...logistics, transport_title_en: value })}
                                            placeholder="Ex: Autocarro de Turismo"
                                            placeholderEn="Ex: Coach Transport"
                                        />
                                        <BilingualField
                                            label="Descrição"
                                            ptValue={logistics.transport_description}
                                            enValue={logistics.transport_description_en || ''}
                                            onChangePt={value => setLogistics({ ...logistics, transport_description: value })}
                                            onChangeEn={value => setLogistics({ ...logistics, transport_description_en: value })}
                                            type="textarea"
                                            rows={4}
                                            placeholder="Detalhes sobre o transporte..."
                                            placeholderEn="Transport details..."
                                        />
                                    </div>
                                    <div>
                                        <ImageUpload
                                            label="Fotografia do Autocarro"
                                            bucket="site-content"
                                            path="logistics/transport"
                                            value={logistics.transport_image}
                                            onChange={(url) => setLogistics({ ...logistics, transport_image: url })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Accommodation Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Hotel className="w-5 h-5 text-purple-500" />
                                    Alojamento
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <BilingualField
                                            label="Classificação"
                                            ptValue={logistics.accommodation_rating}
                                            enValue={logistics.accommodation_rating_en || ''}
                                            onChangePt={value => setLogistics({ ...logistics, accommodation_rating: value })}
                                            onChangeEn={value => setLogistics({ ...logistics, accommodation_rating_en: value })}
                                            placeholder="Ex: Hotéis 4 Estrelas"
                                            placeholderEn="Ex: 4-Star Hotels"
                                        />
                                        <BilingualField
                                            label="Descrição"
                                            ptValue={logistics.accommodation_description}
                                            enValue={logistics.accommodation_description_en || ''}
                                            onChangePt={value => setLogistics({ ...logistics, accommodation_description: value })}
                                            onChangeEn={value => setLogistics({ ...logistics, accommodation_description_en: value })}
                                            type="textarea"
                                            rows={4}
                                            placeholder="Detalhes sobre o alojamento..."
                                            placeholderEn="Accommodation details..."
                                        />
                                    </div>
                                    <div>
                                        <ImageUpload
                                            label="Fotografia do Hotel (Exemplo)"
                                            bucket="site-content"
                                            path="logistics/accommodation"
                                            value={logistics.accommodation_image}
                                            onChange={(url) => setLogistics({ ...logistics, accommodation_image: url })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Inclusions Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <List className="w-5 h-5 text-green-500" />
                                    O que está incluído? (Lista Padrão)
                                </h3>
                                <BilingualListField
                                    label="Incluído no Valor"
                                    ptValues={logistics.included_items || []}
                                    enValues={logistics.included_items_en || []}
                                    onChangePt={values => setLogistics({ ...logistics, included_items: values })}
                                    onChangeEn={values => setLogistics({ ...logistics, included_items_en: values })}
                                    rows={7}
                                    placeholder="Um item por linha&#10;Ex: Alojamento&#10;Transfers"
                                    placeholderEn="One item per line&#10;Ex: Accommodation&#10;Transfers"
                                />
                            </div>

                            {/* Exclusions Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <List className="w-5 h-5 text-red-500" />
                                    O que NÃO está incluído? (Lista Padrão)
                                </h3>
                                <BilingualListField
                                    label="Não Incluído"
                                    ptValues={logistics.not_included_items || []}
                                    enValues={logistics.not_included_items_en || []}
                                    onChangePt={values => setLogistics({ ...logistics, not_included_items: values })}
                                    onChangeEn={values => setLogistics({ ...logistics, not_included_items_en: values })}
                                    rows={7}
                                    placeholder="Um item por linha&#10;Ex: Voos&#10;Seguros"
                                    placeholderEn="One item per line&#10;Ex: Flights&#10;Insurance"
                                />
                            </div>


                        </div>
                    )}

                    {/* TESTIMONIALS SECTION */}
                    {activeSection === 'testimonials' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold font-serif text-slate-900">Testemunhos</h2>
                                    <p className="text-slate-500">Gerencie o feedback dos peregrinos.</p>
                                </div>
                                <button
                                    onClick={startNewTestimonial}
                                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-900/20 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Novo Testemunho
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                {testimonials.map((t) => (
                                    <div
                                        key={t.id}
                                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group hover:shadow-md transition-all cursor-pointer"
                                        onClick={() => setEditingTestimonial(t)}
                                    >
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingTestimonial(t); }}
                                                className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (t.id) handleDeleteTestimonial(t.id); }}
                                                className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full overflow-hidden flex-shrink-0 border border-slate-200">
                                                {t.image_url ? (
                                                    <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                        <MessageSquare className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-0.5">{t.author_name}</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">{t.role}</p>
                                                <p className="text-sm text-slate-600 line-clamp-3 italic">"{t.text}"</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* GALLERY SECTION */}
                    {activeSection === 'gallery' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold font-serif text-slate-900">Galeria de Fotos</h2>
                                <p className="text-slate-500">Imagens exibidas na secção "Momentos Eternos" da página de peregrinações.</p>
                            </div>

                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Adicionar Novas Fotos
                                    </h4>
                                    <div className="max-w-md">
                                        <ImageUpload
                                            bucket="site-content"
                                            path="gallery/general"
                                            onChange={handleGalleryImageAdded}
                                            label="Carregar Foto"
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {galleryImages.map((img) => (
                                        <div key={img.id} className={`group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border transition-all hover:shadow-md ${img.is_active ? 'border-slate-200' : 'border-red-200 opacity-60'}`}>
                                            <img
                                                src={img.image_url}
                                                alt="Gallery"
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />

                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => handleDeleteGalleryImage(img.id)}
                                                        className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors"
                                                        title="Remover"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex justify-start">
                                                    <button
                                                        onClick={() => toggleGalleryImageActive(img)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${img.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                                                    >
                                                        {img.is_active ? 'Visível' : 'Oculta'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {galleryImages.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-slate-400">
                                            Sem imagens na galeria.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* BANKING SECTION */}
                    {activeSection === 'banking' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold font-serif text-slate-900">Dados Bancários</h2>
                                    <p className="text-slate-500">Informação apresentada nas inscrições e doações.</p>
                                </div>
                                <button
                                    onClick={saveLogistics} // Reusing saveLogistics since it saves both
                                    disabled={saving}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-900/10 disabled:opacity-50 transition-all"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar Alterações
                                </button>
                            </div>

                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Landmark className="w-5 h-5 text-indigo-500" />
                                    Transferência Bancária
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">IBAN</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-mono"
                                            value={bankDetails.iban}
                                            onChange={(e) => setBankDetails({ ...bankDetails, iban: e.target.value })}
                                            placeholder="Ex: PT50 0033 0000 0000 0000 0000 0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Titular / Beneficiário</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.beneficiary_name}
                                            onChange={(e) => setBankDetails({ ...bankDetails, beneficiary_name: e.target.value })}
                                            placeholder="Ex: Associação ..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Banco</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.bank_name}
                                            onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                                            placeholder="Ex: Millennium BCP"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">BIC / SWIFT</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.bic_swift}
                                            onChange={(e) => setBankDetails({ ...bankDetails, bic_swift: e.target.value })}
                                            placeholder="Opcional"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Email de Suporte</label>
                                        <input
                                            type="email"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.support_email}
                                            onChange={(e) => setBankDetails({ ...bankDetails, support_email: e.target.value })}
                                            placeholder="Ex: geral@..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Nota de Referência</label>
                                        <textarea
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.reference_note}
                                            onChange={(e) => setBankDetails({ ...bankDetails, reference_note: e.target.value })}
                                            placeholder="Ex: Indique no descritivo o email e referência da inscrição."
                                        />
                                    </div>
                                    <div className="md:col-span-2 pt-2">
                                        <h4 className="text-sm font-bold text-slate-800 mb-3">Endereço da Associação</h4>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Rua / Morada</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.address_street}
                                            onChange={(e) => setBankDetails({ ...bankDetails, address_street: e.target.value })}
                                            placeholder="Ex: Rua ..., nº ..., andar ..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Código Postal / CEP</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.address_postal_code}
                                            onChange={(e) => setBankDetails({ ...bankDetails, address_postal_code: e.target.value })}
                                            placeholder="Ex: 1000-001"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Cidade</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.address_city}
                                            onChange={(e) => setBankDetails({ ...bankDetails, address_city: e.target.value })}
                                            placeholder="Ex: Lisboa"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">País</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={bankDetails.address_country}
                                            onChange={(e) => setBankDetails({ ...bankDetails, address_country: e.target.value })}
                                            placeholder="Ex: Portugal"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Testimonials Slide-Over Editor */}
            <AnimatePresence>
                {editingTestimonial && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setEditingTestimonial(null)}
                            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-full max-w-lg bg-white z-50 shadow-2xl overflow-y-auto"
                        >
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold font-serif text-slate-900">
                                        {editingTestimonial.id ? 'Editar Testemunho' : 'Novo Testemunho'}
                                    </h2>
                                    <button
                                        onClick={() => setEditingTestimonial(null)}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Autor</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={editingTestimonial.author_name}
                                            onChange={e => setEditingTestimonial({ ...editingTestimonial, author_name: e.target.value })}
                                            placeholder="Ex: Maria Santos"
                                        />
                                    </div>
                                    <div>
                                        <BilingualField
                                            label="Cargo / Função"
                                            ptValue={editingTestimonial.role}
                                            enValue={editingTestimonial.role_en || ''}
                                            onChangePt={value => setEditingTestimonial({ ...editingTestimonial, role: value })}
                                            onChangeEn={value => setEditingTestimonial({ ...editingTestimonial, role_en: value })}
                                            placeholder="Ex: Peregrina 2024"
                                            placeholderEn="Ex: Pilgrim 2024"
                                        />
                                    </div>
                                    <div>
                                        <BilingualField
                                            label="Testemunho"
                                            ptValue={editingTestimonial.text}
                                            enValue={editingTestimonial.text_en || ''}
                                            onChangePt={value => setEditingTestimonial({ ...editingTestimonial, text: value })}
                                            onChangeEn={value => setEditingTestimonial({ ...editingTestimonial, text_en: value })}
                                            type="textarea"
                                            rows={8}
                                            placeholder="Escreva aqui o testemunho..."
                                            placeholderEn="Write the testimonial here..."
                                        />
                                    </div>

                                    <div className="border-t border-slate-100 pt-6">
                                        <ImageUpload
                                            label="Fotografia (Opcional)"
                                            bucket="testimonials"
                                            path="avatars"
                                            value={editingTestimonial.image_url}
                                            onChange={(url) => setEditingTestimonial({ ...editingTestimonial, image_url: url })}
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-6">
                                        <button
                                            onClick={() => setEditingTestimonial(null)}
                                            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveTestimonial}
                                            disabled={saving}
                                            className="flex-1 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {saving ? 'A Guardar...' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout >
    );
}
