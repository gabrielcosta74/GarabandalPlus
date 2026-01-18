"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import Link from 'next/link';
import {
    ArrowLeft,
    Save,
    Trash2,
    Plus,
    MapPin,
    Plane,
    Hotel,
    List,
    Image as ImageIcon,
    Search,
    User,
    Users,
    Crown,
    Globe,
    Ticket
} from 'lucide-react';
import BookingsManager from '../../../../components/admin/BookingsManager';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    description: string;
    cover_image: string;
    start_date: string;
    end_date: string;
    total_vacancies: number;
    current_vacancies: number;
    base_price: number;
    status: string;
    min_deposit: number;
    // Logistics
    flight_departure_time: string | null;
    flight_return_time: string | null;
    transport_type: string | null;
    transport_description: string | null;
    transport_image_url: string | null;
    accommodation_rating: string | null;
    accommodation_description: string | null;
    included_items: string[];
    // Flight Preference Option
    // Note: flight_preference is on 'bookings' table, not pilgrimages.
};

type Stage = {
    id?: string;
    pilgrimage_id?: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    image_url: string;
    display_order: number;
};

type DetailedItineraryItem = {
    id?: string;
    pilgrimage_id?: string;
    day_number: number;
    title: string;
    description: string;
    image_url: string;
    display_order: number;
};

type TeamMember = {
    id?: string;
    pilgrimage_id?: string;
    name: string;
    role: string;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string; // Biography/Description
    display_order: number;
};

export default function PilgrimageEditorPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const isNew = id === 'nova';

    const [loading, setLoading] = useState(!isNew);

    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'logistics' | 'itinerary' | 'detailed' | 'team' | 'bookings'>('general');

    // ... (rest of code until tab buttons)

    // Form Stats
    const [form, setForm] = useState<Partial<Pilgrimage>>({
        title: '',
        slug: '',
        description: '',
        base_price: 0,
        total_vacancies: 50,
        current_vacancies: 50,
        min_deposit: 500,
        status: 'open',
        included_items: []
    });

    const [stages, setStages] = useState<Stage[]>([]);
    const [detailedItems, setDetailedItems] = useState<DetailedItineraryItem[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    useEffect(() => {
        if (!isNew) {
            fetchPilgrimage();
        }
    }, [id]);

    const fetchPilgrimage = async () => {
        if (!supabaseBrowser) return;
        // 1. Fetch Main Data
        const { data, error } = await supabaseBrowser
            .from('pilgrimages')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error(error);
            return;
        }
        setForm(data);

        // 2. Fetch Stages
        const { data: sData } = await supabaseBrowser
            .from('pilgrimage_stages')
            .select('*')
            .eq('pilgrimage_id', id)
            .order('display_order');

        if (sData) setStages(sData);

        // 3. Fetch Detailed Itinerary
        const { data: dData } = await supabaseBrowser
            .from('pilgrimage_itinerary_items')
            .select('*')
            .eq('pilgrimage_id', id)
            .order('day_number', { ascending: true }); // Order by day number

        if (dData) setDetailedItems(dData);

        // 4. Fetch Team Members
        const { data: tData } = await supabaseBrowser
            .from('pilgrimage_team_members')
            .select('*')
            .eq('pilgrimage_id', id)
            .order('display_order'); // or order by is_special_guest desc

        if (tData) setTeamMembers(tData);

        setLoading(false);
    };

    const handleSave = async () => {
        if (!supabaseBrowser) { alert('Erro de configuração Supabase'); return; }
        setSaving(true);
        try {
            let pid = id;

            // 1. Upsert Pilgrimage
            const payload = { ...form };
            if (isNew) delete (payload as any).id;

            const { data, error } = await supabaseBrowser
                .from('pilgrimages')
                .upsert(isNew ? [payload] : [{ ...payload, id }])
                .select()
                .single();

            if (error) throw error;
            pid = data.id;

            // 2. Upsert Stages (Only if not new, or after create)
            if (stages.length > 0) {
                const stagesToSave = stages.map(({ id, ...rest }) => {
                    const stagePayload: any = { ...rest, pilgrimage_id: pid };
                    // Only include ID if it's a real UUID (not temp)
                    if (id && !id.toString().startsWith('temp')) {
                        stagePayload.id = id;
                    }
                    return stagePayload;
                });

                const { error: sError } = await supabaseBrowser
                    .from('pilgrimage_stages')
                    .upsert(stagesToSave);

                if (sError) throw sError;
            }

            // 3. Upsert Detailed Itinerary Items
            if (detailedItems.length > 0) {
                const itemsToSave = detailedItems.map(({ id, ...rest }) => {
                    const itemPayload: any = { ...rest, pilgrimage_id: pid };
                    // Only include ID if it's a real UUID (not temp)
                    if (id && !id.toString().startsWith('temp')) {
                        itemPayload.id = id;
                    }
                    return itemPayload;
                });

                const { error: dError } = await supabaseBrowser
                    .from('pilgrimage_itinerary_items')
                    .upsert(itemsToSave);

                if (dError) throw dError;
            }

            // 4. Upsert Team Members
            if (teamMembers.length > 0) {
                const teamToSave = teamMembers.map(({ id, ...rest }) => {
                    const teamPayload: any = { ...rest, pilgrimage_id: pid };
                    if (id && !id.toString().startsWith('temp')) {
                        teamPayload.id = id;
                    }
                    return teamPayload;
                });

                const { error: tError } = await supabaseBrowser
                    .from('pilgrimage_team_members')
                    .upsert(teamToSave);

                if (tError) throw tError;
            }

            alert('Guardado com sucesso!');
            if (isNew) router.push(`/admin/peregrinacoes/${pid}`);

        } catch (err: any) {
            console.error(err);
            alert('Erro ao guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // State for Search Suggestions
    const [suggestions, setSuggestions] = useState<Record<number, any[]>>({});
    const [searchTimeouts, setSearchTimeouts] = useState<Record<number, NodeJS.Timeout>>({});

    // 1. Search (Debounced)
    const handleLocationSearch = (index: number, query: string) => {
        // Clear previous timeout
        if (searchTimeouts[index]) clearTimeout(searchTimeouts[index]);

        if (!query || query.length < 3) {
            setSuggestions(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
            return;
        }

        // Set new timeout (500ms debounce)
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await res.json();
                setSuggestions(prev => ({ ...prev, [index]: data }));
            } catch (err) {
                console.error(err);
            }
        }, 500);

        setSearchTimeouts(prev => ({ ...prev, [index]: timeout }));
    };

    // 2. Select Location
    const selectLocation = (index: number, result: any) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        const newStages = [...stages];
        newStages[index] = {
            ...newStages[index],
            lat,
            lng,
            // Use the name from result, but keep existing description
            title: newStages[index].title === 'Nova Paragem' || !newStages[index].title ? result.name || result.display_name.split(',')[0] : newStages[index].title
        };
        setStages(newStages);

        // Clear suggestions
        setSuggestions(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    const addStage = () => {
        setStages([...stages, {
            id: `temp-${Date.now()}`,
            title: 'Nova Paragem',
            description: '',
            lat: 40.0,
            lng: -4.0,
            image_url: '',
            display_order: stages.length + 1
        }]);
    };

    const removeStage = async (index: number) => {
        if (!supabaseBrowser) return;
        const stage = stages[index];
        if (stage.id && !stage.id.startsWith('temp')) {
            // Delete from DB directly? Or just filter out and let upsert handle?
            // Upsert won't delete missing. We need explicit delete.
            const { error } = await supabaseBrowser.from('pilgrimage_stages').delete().eq('id', stage.id);
            if (error) {
                alert('Erro ao apagar do DB');
                return;
            }
        }
        const newStages = [...stages];
        newStages.splice(index, 1);
        setStages(newStages);
    };

    const updateStage = (index: number, field: keyof Stage, value: any) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], [field]: value };
        setStages(newStages);
    };

    // --- Detailed Itinerary Helpers ---

    const addDetailedItem = () => {
        setDetailedItems([...detailedItems, {
            id: `temp-${Date.now()}`,
            day_number: detailedItems.length + 1,
            title: '',
            description: '',
            image_url: '',
            display_order: detailedItems.length + 1
        }]);
    };

    const removeDetailedItem = async (index: number) => {
        if (!supabaseBrowser) return;
        const item = detailedItems[index];
        if (item.id && !item.id.startsWith('temp')) {
            const { error } = await supabaseBrowser.from('pilgrimage_itinerary_items').delete().eq('id', item.id);
            if (error) {
                alert('Erro ao apagar do DB');
                return;
            }
        }
        const newItems = [...detailedItems];
        newItems.splice(index, 1);
        setDetailedItems(newItems);
    };

    const updateDetailedItem = (index: number, field: keyof DetailedItineraryItem, value: any) => {
        const newItems = [...detailedItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setDetailedItems(newItems);
    };

    if (loading) return <div className="p-10 text-center">A carregar...</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/admin/peregrinacoes" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 font-serif">
                            {isNew ? 'Nova Peregrinação' : form.title}
                        </h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${form.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {form.status}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all font-medium shadow-lg hover:shadow-slate-900/20"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'A Guardar...' : 'Guardar Alterações'}
                </button>
            </div>

            <div className="max-w-5xl mx-auto mt-8 px-8">

                {/* Tabs */}
                <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-fit flex-wrap">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Informação Geral
                    </button>
                    <button
                        onClick={() => setActiveTab('logistics')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logistics' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Voos & Horários
                    </button>
                    <button
                        onClick={() => setActiveTab('itinerary')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'itinerary' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Roteiro 3D
                    </button>
                    <button
                        onClick={() => setActiveTab('detailed')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'detailed' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Itinerário Detalhado
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Equipa & Convidados
                    </button>
                    {!isNew && (
                        <button
                            onClick={() => setActiveTab('bookings')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'bookings' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Inscrições
                        </button>
                    )}
                </div>

                {/* --- TAB: GENERAL --- */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Título da Viagem</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Slug (URL)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all font-mono text-sm"
                                        value={form.slug}
                                        onChange={e => setForm({ ...form, slug: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Estado</label>
                                    <select
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.status}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                    >
                                        <option value="open">Abertas (Open)</option>
                                        <option value="waitlist">Lista de Espera</option>
                                        <option value="closed">Encerradas</option>
                                        <option value="draft">Rascunho</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Descrição Completa</label>
                                <textarea
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all h-32"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Donativo Base (€)</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.base_price}
                                        onChange={e => setForm({ ...form, base_price: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Sinal Reserva (€)</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.min_deposit}
                                        onChange={e => setForm({ ...form, min_deposit: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Total Vagas</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.total_vacancies}
                                        onChange={e => setForm({ ...form, total_vacancies: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Imagem de Capa (URL)</label>
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.cover_image || ''}
                                        onChange={e => setForm({ ...form, cover_image: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    {form.cover_image && (
                                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                                            <img src={form.cover_image} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Data Início</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.start_date ? new Date(form.start_date).toISOString().split('T')[0] : ''}
                                        onChange={e => setForm({ ...form, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Data Fim</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                                        value={form.end_date ? new Date(form.end_date).toISOString().split('T')[0] : ''}
                                        onChange={e => setForm({ ...form, end_date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* --- TAB: LOGISTICS --- */}
                {activeTab === 'logistics' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Flights */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold font-serif text-slate-900 mb-6 flex items-center gap-2">
                                <Plane className="w-5 h-5 text-yellow-600" /> Detalhes do Voo
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Partida (Data/Hora)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                                        value={form.flight_departure_time ? new Date(form.flight_departure_time).toISOString().slice(0, 16) : ''}
                                        onChange={e => setForm({ ...form, flight_departure_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Regresso (Data/Hora)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                                        value={form.flight_return_time ? new Date(form.flight_return_time).toISOString().slice(0, 16) : ''}
                                        onChange={e => setForm({ ...form, flight_return_time: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-blue-800 text-sm">
                            <p><strong>Nota:</strong> O transporte terrestre, alojamento e inclusões são geridos globalmente em "Conteúdo Global".</p>
                        </div>
                    </div>
                )}

                {/* --- TAB: ITINERARY (3D) --- */}
                {activeTab === 'itinerary' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-900 text-white p-6 rounded-2xl">
                            <h3 className="font-bold text-lg mb-2">Editor de Roteiro 3D</h3>
                            <p className="text-slate-400 text-sm">Adicione aqui os pontos chave da peregrinação. Eles aparecerão no Mapa 3D interativo.</p>
                        </div>

                        <div className="space-y-4">
                            {stages.map((stage, idx) => (
                                <div key={stage.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 relative group">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => removeStage(idx)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    </div>

                                    {/* Order Badge */}
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 flex-shrink-0">
                                        {idx + 1}
                                    </div>

                                    {/* Fields */}
                                    <div className="flex-1 space-y-4">

                                        {/* Search Box (Autocomplete) */}
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Pesquisar Localização</label>
                                            <div className="relative">
                                                <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg pr-2 focus-within:ring-2 focus-within:ring-slate-200">
                                                    <Search className="w-4 h-4 text-slate-400 ml-2" />
                                                    <input
                                                        type="text"
                                                        placeholder="Escreva para pesquisar (ex: Fátima)..."
                                                        className="flex-1 p-2 outline-none text-sm bg-transparent"
                                                        onChange={(e) => handleLocationSearch(idx, e.target.value)}
                                                    />
                                                </div>

                                                {/* Suggestions Dropdown */}
                                                {suggestions[idx] && suggestions[idx].length > 0 && (
                                                    <div className="absolute top-full left-0 w-full bg-white rounded-lg shadow-xl border border-slate-100 mt-2 z-20 max-h-60 overflow-y-auto">
                                                        {suggestions[idx].map((item: any, i: number) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => selectLocation(idx, item)}
                                                                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col"
                                                            >
                                                                <span className="font-bold text-slate-900">{item.name || item.display_name.split(',')[0]}</span>
                                                                <span className="text-xs text-slate-500 truncate">{item.display_name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Título (Display)</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                                                    value={stage.title}
                                                    onChange={e => updateStage(idx, 'title', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Latitude</label>
                                                <input
                                                    type="number" step="0.0001"
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono"
                                                    value={stage.lat}
                                                    onChange={e => updateStage(idx, 'lat', parseFloat(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Longitude</label>
                                                <input
                                                    type="number" step="0.0001"
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono"
                                                    value={stage.lng}
                                                    onChange={e => updateStage(idx, 'lng', parseFloat(e.target.value))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                                                value={stage.description}
                                                onChange={e => updateStage(idx, 'description', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Imagem (URL)</label>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                                    value={stage.image_url || ''}
                                                    onChange={e => updateStage(idx, 'image_url', e.target.value)}
                                                />
                                                {stage.image_url && (
                                                    <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden">
                                                        <img src={stage.image_url} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addStage}
                            className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold hover:border-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> Adicionar Paragem
                        </button>
                    </div>
                )}

                {/* --- TAB: DETAILED ITINERARY --- */}
                {activeTab === 'detailed' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-900 text-white p-6 rounded-2xl">
                            <h3 className="font-bold text-lg mb-2">Editor de Itinerário Detalhado</h3>
                            <p className="text-slate-400 text-sm">Adicione aqui a descrição longa dia-a-dia da viagem. Este conteúdo aparece abaixo do mapa interativo.</p>
                        </div>

                        <div className="space-y-4">
                            {detailedItems.map((item, idx) => (
                                <div key={item.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 relative group">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => removeDetailedItem(idx)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    </div>

                                    {/* Day Badge */}
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-bold text-slate-500 flex-shrink-0 border border-slate-200">
                                        <span className="text-xs uppercase">Dia</span>
                                        <span className="text-2xl text-slate-900">{item.day_number}</span>
                                    </div>

                                    {/* Fields */}
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Dia Nº</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                                                    value={item.day_number}
                                                    onChange={e => updateDetailedItem(idx, 'day_number', parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Título do Dia</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                                                    value={item.title}
                                                    onChange={e => updateDetailedItem(idx, 'title', e.target.value)}
                                                    placeholder="Ex: Chegada a Lisboa"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Descrição Completa</label>
                                            <textarea
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg h-32"
                                                value={item.description || ''}
                                                onChange={e => updateDetailedItem(idx, 'description', e.target.value)}
                                                placeholder="Descreva as atividades do dia em detalhe..."
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Imagem Ilustrativa (URL)</label>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                                    value={item.image_url || ''}
                                                    onChange={e => updateDetailedItem(idx, 'image_url', e.target.value)}
                                                    placeholder="https://..."
                                                />
                                                {item.image_url && (
                                                    <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                                        <img src={item.image_url} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addDetailedItem}
                            className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold hover:border-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> Adicionar Dia ao Itinerário
                        </button>
                    </div>
                )}

                {/* --- TAB: TEAM --- */}
                {activeTab === 'team' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Equipa e Convidados</h2>
                                <p className="text-slate-500 text-sm">Gere quem vai acompanhar esta peregrinação.</p>
                            </div>
                            <button
                                onClick={() => setTeamMembers([...teamMembers, {
                                    id: `temp-${Date.now()}`,
                                    name: 'Novo Membro',
                                    role: 'Staff',
                                    country: 'Portugal',
                                    image_url: '',
                                    is_special_guest: false,
                                    description: '',
                                    display_order: teamMembers.length + 1
                                }])}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Adicionar Pessoa
                            </button>
                        </div>

                        <div className="grid gap-4">
                            {teamMembers.map((member, idx) => (
                                <div key={member.id || idx} className={`bg-white p-6 rounded-2xl shadow-sm border ${member.is_special_guest ? 'border-yellow-400/50 ring-1 ring-yellow-100' : 'border-slate-200'}`}>
                                    <div className="flex gap-4 items-start">
                                        {/* Valid Sort Handle (Conceptual) */}
                                        <div className="mt-3 text-slate-300">
                                            <List className="w-4 h-4" />
                                        </div>

                                        {/* Image Preview */}
                                        <div className="w-20 h-20 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 relative group">
                                            {member.image_url ? (
                                                <img src={member.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <User className="w-8 h-8" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Fields */}
                                        <div className="flex-1 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
                                                    <input
                                                        type="text"
                                                        value={member.name}
                                                        onChange={e => {
                                                            const newMembers = [...teamMembers];
                                                            newMembers[idx].name = e.target.value;
                                                            setTeamMembers(newMembers);
                                                        }}
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Cargo / Função</label>
                                                    <input
                                                        type="text"
                                                        value={member.role}
                                                        onChange={e => {
                                                            const newMembers = [...teamMembers];
                                                            newMembers[idx].role = e.target.value;
                                                            setTeamMembers(newMembers);
                                                        }}
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Foto (URL)</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={member.image_url}
                                                            onChange={e => {
                                                                const newMembers = [...teamMembers];
                                                                newMembers[idx].image_url = e.target.value;
                                                                setTeamMembers(newMembers);
                                                            }}
                                                            placeholder="https://..."
                                                            className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase">País de Origem</label>
                                                    <div className="relative">
                                                        <Globe className="w-3 h-3 absolute left-3 top-3 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={member.country}
                                                            onChange={e => {
                                                                const newMembers = [...teamMembers];
                                                                newMembers[idx].country = e.target.value;
                                                                setTeamMembers(newMembers);
                                                            }}
                                                            className="w-full pl-8 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Special Guest Toggle */}
                                            <div className="flex items-center gap-3 py-2">
                                                <button
                                                    onClick={() => {
                                                        const newMembers = [...teamMembers];
                                                        newMembers[idx].is_special_guest = !newMembers[idx].is_special_guest;
                                                        setTeamMembers(newMembers);
                                                    }}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${member.is_special_guest ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
                                                >
                                                    <Crown className="w-3 h-3" />
                                                    {member.is_special_guest ? 'Convidado Especial (Destaque)' : 'Membro Regular'}
                                                </button>
                                                {member.is_special_guest && <span className="text-xs text-slate-400">Aparece em destaque no topo da lista.</span>}
                                            </div>

                                            {/* Description (Only for Special Guests) */}
                                            {member.is_special_guest && (
                                                <div className="animate-in fade-in slide-in-from-top-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Biografia / Descrição</label>
                                                    <textarea
                                                        rows={3}
                                                        value={member.description || ''}
                                                        onChange={e => {
                                                            const newMembers = [...teamMembers];
                                                            newMembers[idx].description = e.target.value;
                                                            setTeamMembers(newMembers);
                                                        }}
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none focus:border-blue-500 mt-1"
                                                        placeholder="Breve descrição sobre o convidado..."
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <button
                                            onClick={async () => {
                                                if (!confirm('Eliminar este membro?')) return;
                                                if (member.id && !member.id.startsWith('temp') && supabaseBrowser) {
                                                    await supabaseBrowser.from('pilgrimage_team_members').delete().eq('id', member.id);
                                                }
                                                setTeamMembers(teamMembers.filter((_, i) => i !== idx));
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {teamMembers.length === 0 && (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">Ainda sem equipa definida.</p>
                                    <button
                                        onClick={() => setTeamMembers([...teamMembers, {
                                            id: `temp-${Date.now()}`,
                                            name: 'Novo Membro',
                                            role: 'Staff',
                                            country: 'Portugal',
                                            image_url: '',
                                            is_special_guest: false,
                                            description: '',
                                            display_order: 1
                                        }])}
                                        className="text-blue-600 font-bold text-sm mt-2 hover:underline"
                                    >
                                        Adicionar o primeiro membro
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB: BOOKINGS --- */}
                {activeTab === 'bookings' && !isNew && (
                    <BookingsManager pilgrimageId={id} />
                )}

            </div>
        </div >
    );
}
