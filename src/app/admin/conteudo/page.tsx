"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import AdminLayout from '../../../components/admin/AdminLayout';
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
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GlobalLogistics = {
    transport_title: string;
    transport_description: string;
    transport_image: string;
    accommodation_rating: string;
    accommodation_description: string;
    accommodation_image: string;
    included_items: string[];
    not_included_items: string[];
};

type Testimonial = {
    id?: string;
    author_name: string;
    role: string;
    text: string;
    image_url: string;
    display_order: number;
};

export default function GlobalContentPage() {
    const [activeSection, setActiveSection] = useState<'logistics' | 'testimonials'>('logistics');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Logistics State
    const [logistics, setLogistics] = useState<GlobalLogistics>({
        transport_title: '',
        transport_description: '',
        transport_image: '',
        accommodation_rating: '',
        accommodation_description: '',
        accommodation_image: '',
        included_items: [],
        not_included_items: []
    });
    const [bankDetails, setBankDetails] = useState<BankTransferDetails>(DEFAULT_BANK_TRANSFER_DETAILS);

    // Testimonials State
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);

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

            if (logisticsRow?.content) setLogistics(logisticsRow.content);
            if (bankDetailsRow?.content) setBankDetails(normalizeBankTransferDetails(bankDetailsRow.content));
        }

        // 2. Fetch Testimonials
        const { data: tData } = await supabaseBrowser
            .from('testimonials')
            .select('*')
            .order('display_order');

        if (tData) setTestimonials(tData);

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
            text: '',
            image_url: '',
            display_order: testimonials.length + 1
        });
    };

    return (
        <AdminLayout title="Conteúdo Global" isLoading={loading}>
            <Toaster position="top-right" richColors />
            <div className="flex flex-col lg:flex-row gap-8 pb-20">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
                    <button
                        onClick={() => setActiveSection('logistics')}
                        className={`w-full flex items-center justify-between p-4 rounded-xl text-left font-medium transition-all ${activeSection === 'logistics'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        <span className="flex items-center gap-3">
                            <Bus className="w-5 h-5" />
                            Logística & Inclusões
                        </span>
                        {activeSection === 'logistics' && <ChevronRight className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={() => setActiveSection('testimonials')}
                        className={`w-full flex items-center justify-between p-4 rounded-xl text-left font-medium transition-all ${activeSection === 'testimonials'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        <span className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5" />
                            Testemunhos
                            <span className="bg-slate-200/20 px-2 py-0.5 rounded text-xs ml-auto">
                                {testimonials.length}
                            </span>
                        </span>
                        {activeSection === 'testimonials' && <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">

                    {/* LOGISTICS SECTION */}
                    {activeSection === 'logistics' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold font-serif text-slate-900">Logística Global</h2>
                                <button
                                    onClick={saveLogistics}
                                    disabled={saving}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-900/10 disabled:opacity-50 transition-all"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar Alterações
                                </button>
                            </div>

                            {/* Transport Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Bus className="w-5 h-5 text-blue-500" />
                                    Transporte
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Título</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={logistics.transport_title}
                                                onChange={e => setLogistics({ ...logistics, transport_title: e.target.value })}
                                                placeholder="Ex: Autocarro de Turismo"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                                            <textarea
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-32 resize-none focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={logistics.transport_description}
                                                onChange={e => setLogistics({ ...logistics, transport_description: e.target.value })}
                                            />
                                        </div>
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
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Classificação</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={logistics.accommodation_rating}
                                                onChange={e => setLogistics({ ...logistics, accommodation_rating: e.target.value })}
                                                placeholder="Ex: Hotéis 4 Estrelas"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                                            <textarea
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-32 resize-none focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={logistics.accommodation_description}
                                                onChange={e => setLogistics({ ...logistics, accommodation_description: e.target.value })}
                                            />
                                        </div>
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
                                <div className="space-y-3">
                                    {logistics.included_items?.map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-xs font-bold text-slate-500 flex-shrink-0">
                                                {idx + 1}
                                            </span>
                                            <input
                                                type="text"
                                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={item}
                                                onChange={(e) => {
                                                    const newItems = [...(logistics.included_items || [])];
                                                    newItems[idx] = e.target.value;
                                                    setLogistics({ ...logistics, included_items: newItems });
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newItems = [...(logistics.included_items || [])];
                                                    newItems.splice(idx, 1);
                                                    setLogistics({ ...logistics, included_items: newItems });
                                                }}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setLogistics({ ...logistics, included_items: [...(logistics.included_items || []), ''] })}
                                        className="mt-4 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg flex items-center gap-2 w-fit transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Item
                                    </button>
                                </div>
                            </div>

                            {/* Exclusions Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <List className="w-5 h-5 text-red-500" />
                                    O que NÃO está incluído? (Lista Padrão)
                                </h3>
                                <div className="space-y-3">
                                    {logistics.not_included_items?.map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-xs font-bold text-slate-500 flex-shrink-0">
                                                {idx + 1}
                                            </span>
                                            <input
                                                type="text"
                                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={item}
                                                onChange={(e) => {
                                                    const newItems = [...(logistics.not_included_items || [])];
                                                    newItems[idx] = e.target.value;
                                                    setLogistics({ ...logistics, not_included_items: newItems });
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newItems = [...(logistics.not_included_items || [])];
                                                    newItems.splice(idx, 1);
                                                    setLogistics({ ...logistics, not_included_items: newItems });
                                                }}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setLogistics({ ...logistics, not_included_items: [...(logistics.not_included_items || []), ''] })}
                                        className="mt-4 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg flex items-center gap-2 w-fit transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Item
                                    </button>
                                </div>
                            </div>

                            {/* Bank Transfer Data Card */}
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Landmark className="w-5 h-5 text-indigo-500" />
                                    Dados Bancários (Transferência)
                                </h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    Estes dados são usados automaticamente nas páginas de doação e inscrição quando o utilizador escolhe transferência bancária.
                                </p>
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
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Código Postal</label>
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
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Cargo / Função</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={editingTestimonial.role}
                                            onChange={e => setEditingTestimonial({ ...editingTestimonial, role: e.target.value })}
                                            placeholder="Ex: Peregrina 2024"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Testemunho</label>
                                        <textarea
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-40 resize-none focus:ring-2 focus:ring-slate-900 outline-none"
                                            value={editingTestimonial.text}
                                            onChange={e => setEditingTestimonial({ ...editingTestimonial, text: e.target.value })}
                                            placeholder="Escreva aqui o testemunho..."
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
        </AdminLayout>
    );
}
