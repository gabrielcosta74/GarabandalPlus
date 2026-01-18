"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Save,
    Bus,
    Hotel,
    List,
    MessageSquare,
    Plus,
    Trash2,
    Image as ImageIcon,
    Star
} from 'lucide-react';

type GlobalLogistics = {
    transport_title: string;
    transport_description: string;
    transport_image: string;
    accommodation_rating: string;
    accommodation_description: string;
    accommodation_image: string;
    included_items: string[];
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
    const [activeTab, setActiveTab] = useState<'logistics' | 'testimonials'>('logistics');
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
        included_items: []
    });

    // Testimonials State
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

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
            .in('key', ['logistics_global']);

        if (cData && cData.length > 0) {
            setLogistics(cData[0].content);
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
        if (!supabaseBrowser) return;
        setSaving(true);

        const { error } = await supabaseBrowser
            .from('site_content')
            .upsert({
                key: 'logistics_global',
                content: logistics,
                updated_at: new Date().toISOString()
            });

        if (error) alert('Erro ao guardar logística: ' + error.message);
        else alert('Logística guardada com sucesso!');

        setSaving(false);
    };

    const saveTestimonial = async (testimonial: Testimonial, index: number) => {
        if (!supabaseBrowser) return;

        // Optimistic Update
        const newTestimonials = [...testimonials];

        const { data, error } = await supabaseBrowser
            .from('testimonials')
            .upsert(testimonial)
            .select()
            .single();

        if (error) {
            alert('Erro ao guardar: ' + error.message);
            return;
        }

        if (data) {
            newTestimonials[index] = data;
            setTestimonials(newTestimonials);
        }
    };

    const deleteTestimonial = async (id: string, index: number) => {
        if (!supabaseBrowser) return;
        if (!confirm('Tem a certeza que quer apagar este testemunho?')) return;

        const { error } = await supabaseBrowser.from('testimonials').delete().eq('id', id);

        if (error) {
            alert('Erro ao apagar: ' + error.message);
            return;
        }

        const newTestimonials = [...testimonials];
        newTestimonials.splice(index, 1);
        setTestimonials(newTestimonials);
    };

    const addTestimonial = () => {
        setTestimonials([...testimonials, {
            author_name: 'Novo Testemunho',
            role: 'Peregrino',
            text: '',
            image_url: '',
            display_order: testimonials.length + 1
        }]);
    };

    if (loading) return <div className="p-10 text-center">A carregar...</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 font-serif">Conteúdo Global</h1>
                    <p className="text-sm text-slate-500">Edite textos que aparecem em todas as peregrinações</p>
                </div>
                {activeTab === 'logistics' && (
                    <button
                        onClick={saveLogistics}
                        disabled={saving}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all font-medium shadow-lg hover:shadow-slate-900/20"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'A Guardar...' : 'Guardar Alterações'}
                    </button>
                )}
            </div>

            <div className="max-w-5xl mx-auto mt-8 px-8">

                {/* Tabs */}
                <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-fit">
                    <button
                        onClick={() => setActiveTab('logistics')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logistics' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Logística & Inclusões
                    </button>
                    <button
                        onClick={() => setActiveTab('testimonials')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'testimonials' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Testemunhos
                    </button>
                </div>

                {/* --- TAB: LOGISTICS --- */}
                {activeTab === 'logistics' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Transport */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold font-serif text-slate-900 mb-6 flex items-center gap-2">
                                <Bus className="w-5 h-5 text-slate-600" /> Transporte Terrestre
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Título do Transporte</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                                        value={logistics.transport_title}
                                        onChange={e => setLogistics({ ...logistics, transport_title: e.target.value })}
                                        placeholder="Ex: Autocarro de Turismo"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Imagem (URL)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                            value={logistics.transport_image}
                                            onChange={e => setLogistics({ ...logistics, transport_image: e.target.value })}
                                        />
                                        {logistics.transport_image && (
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                                <img src={logistics.transport_image} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24"
                                        value={logistics.transport_description}
                                        onChange={e => setLogistics({ ...logistics, transport_description: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Accommodation */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold font-serif text-slate-900 mb-6 flex items-center gap-2">
                                <Hotel className="w-5 h-5 text-slate-600" /> Alojamento Padrão
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Classificação (Estrelas)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                                        value={logistics.accommodation_rating}
                                        onChange={e => setLogistics({ ...logistics, accommodation_rating: e.target.value })}
                                        placeholder="Ex: 4 Estrelas Superior"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Descrição do Alojamento</label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24"
                                        value={logistics.accommodation_description}
                                        onChange={e => setLogistics({ ...logistics, accommodation_description: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Imagem do Hotel (URL)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                            value={logistics.accommodation_image || ''}
                                            onChange={e => setLogistics({ ...logistics, accommodation_image: e.target.value })}
                                        />
                                        {logistics.accommodation_image && (
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                                <img src={logistics.accommodation_image} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inclusions */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold font-serif text-slate-900 mb-6 flex items-center gap-2">
                                <List className="w-5 h-5 text-slate-600" /> O que inclui? (Padrão)
                            </h3>
                            <div className="space-y-3">
                                {logistics.included_items?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg"
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
                                            className="p-2 text-red-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setLogistics({ ...logistics, included_items: [...(logistics.included_items || []), ''] })}
                                    className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar Item
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: TESTIMONIALS --- */}
                {activeTab === 'testimonials' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg mb-1">Testemunhos</h3>
                                <p className="text-slate-400 text-sm">Gerencie o que os peregrinos dizem sobre nós.</p>
                            </div>
                            <button
                                onClick={addTestimonial}
                                className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors"
                            >
                                + Novo
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {testimonials.map((t, idx) => (
                                <div key={t.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group">
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { if (t.id) saveTestimonial(t, idx); else alert('Edite os campos e o save é automático ao blur? Nao, vou por botao save individual por agora.'); }}
                                            className="hidden" // Hiding implicit save logic for now, using individual inputs
                                        ></button>
                                        <button
                                            onClick={() => saveTestimonial(t, idx)}
                                            className="text-white bg-green-500 hover:bg-green-600 p-2 rounded-lg font-bold text-xs flex items-center gap-1 shadow-md transform transition-transform hover:scale-105"
                                        >
                                            <Save className="w-3 h-3" /> Guardar
                                        </button>
                                        <button
                                            onClick={() => t.id && deleteTestimonial(t.id, idx)}
                                            className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex gap-6 items-start">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full overflow-hidden flex-shrink-0 border border-slate-200">
                                            {t.image_url ? (
                                                <img src={t.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-6 h-6" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
                                                    <input
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                                                        value={t.author_name}
                                                        onChange={e => {
                                                            const newT = [...testimonials];
                                                            newT[idx].author_name = e.target.value;
                                                            setTestimonials(newT);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Cargo / Ano</label>
                                                    <input
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                                        value={t.role}
                                                        onChange={e => {
                                                            const newT = [...testimonials];
                                                            newT[idx].role = e.target.value;
                                                            setTestimonials(newT);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Testemunho</label>
                                                <textarea
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-20"
                                                    value={t.text}
                                                    onChange={e => {
                                                        const newT = [...testimonials];
                                                        newT[idx].text = e.target.value;
                                                        setTestimonials(newT);
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Foto (URL)</label>
                                                <input
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-500"
                                                    value={t.image_url || ''}
                                                    onChange={e => {
                                                        const newT = [...testimonials];
                                                        newT[idx].image_url = e.target.value;
                                                        setTestimonials(newT);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
