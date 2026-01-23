"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import {
    Save,
    MapPin,
    Plane,
    Hotel,
    List,
    Users,
    Ticket,
    FileText,
    Clock
} from 'lucide-react';
import BookingsManager from '../../../../components/admin/BookingsManager';
import WaitlistManager from '../../../../components/admin/WaitlistManager';
import AdminShell from '../../AdminShell';
import GeneralInfoTab from './components/GeneralInfoTab';
import LogisticsTab from './components/LogisticsTab';
import PricingTab from './components/PricingTab';
import ItineraryTab from './components/ItineraryTab';
import DetailedItineraryTab from './components/DetailedItineraryTab';
import TeamTab from './components/TeamTab';
import { Toaster, toast } from 'sonner';

// --- Types ---
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
    deposit_value: number;
    // Logistics
    flight_departure_time: string | null;
    flight_return_time: string | null;
    transport_type: string | null;
    transport_description: string | null;
    transport_image_url: string | null;
    accommodation_rating: string | null;
    accommodation_description: string | null;
    included_items: string[];
    // New fields for upgrade
    meeting_point_text?: string;
    meeting_end_text?: string;
    flight_info_text?: string;
    flight_price_from?: number; // New: Flight price option
    group_flight_details?: string; // New: Option B details
    payment_plan_text?: string;
    cancellation_policy_text?: string;
    not_included_items?: string[];
    itinerary_summary?: string;
    registration_deadline?: string; // New: Deadline
    // Pricing Config (JSONB)
    pricing_config: {
        room_supplements?: {
            single?: number;
            double?: number;
            triple?: number;
            quadruple?: number;
        };
    } | null;
};

export default function PilgrimageEditorPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const isNew = id === 'nova';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'logistics' | 'pricing' | 'itinerary' | 'detailed' | 'team' | 'bookings' | 'waitlist'>('general');

    // State
    const [form, setForm] = useState<Partial<Pilgrimage>>({
        title: '',
        slug: '',
        description: '',
        base_price: 0,
        total_vacancies: 0,
        current_vacancies: 0,
        deposit_value: 0,
        status: 'open',
        included_items: [],
        pricing_config: {
            room_supplements: {
                single: 0, double: 0, triple: 0, quadruple: 0
            }
        }
    });

    const [stages, setStages] = useState<any[]>([]);
    const [detailedItems, setDetailedItems] = useState<any[]>([]);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Search Suggestions State (for Itinerary)
    const [suggestions, setSuggestions] = useState<Record<number, any[]>>({});
    const [searchTimeouts, setSearchTimeouts] = useState<Record<number, NodeJS.Timeout>>({});

    useEffect(() => {
        if (!isNew) {
            fetchPilgrimage();
        }
    }, [id]);

    const fetchPilgrimage = async () => {
        if (!supabaseBrowser) return;
        try {
            // 1. Fetch Main Data
            const { data, error } = await supabaseBrowser
                .from('pilgrimages')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error(error);
                toast.error("Erro ao carregar peregrinação.");
                return; // Will exit, but finally block will run
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
                .order('day_number', { ascending: true });
            if (dData) setDetailedItems(dData);

            // 4. Fetch Team Members
            const { data: tData } = await supabaseBrowser
                .from('pilgrimage_team_members')
                .select('*')
                .eq('pilgrimage_id', id)
                .order('display_order');
            if (tData) setTeamMembers(tData);

        } catch (err) {
            console.error(err);
            toast.error("Ocorreu um erro inesperado.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!supabaseBrowser) { toast.error('Erro de configuração Supabase'); return; }
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

            // 2. Upsert Stages
            if (stages.length > 0) {
                const stagesToSave = stages.map(({ id, ...rest }) => {
                    const stagePayload: any = { ...rest, pilgrimage_id: pid };
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

            // 3. Upsert Detailed Itinerary
            if (detailedItems.length > 0) {
                const itemsToSave = detailedItems.map(({ id, ...rest }) => {
                    const itemPayload: any = { ...rest, pilgrimage_id: pid };
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

            // 4. Upsert Team
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

            toast.success('Peregrinação guardada com sucesso!');
            if (isNew) router.push(`/admin/peregrinacoes/${pid}`);

        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // --- Helpers for Sub-components ---

    // Itinerary Search
    const handleLocationSearch = (index: number, query: string) => {
        if (searchTimeouts[index]) clearTimeout(searchTimeouts[index]);
        if (!query || query.length < 3) {
            setSuggestions(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
            return;
        }
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await res.json();
                setSuggestions(prev => ({ ...prev, [index]: data }));
            } catch (err) { console.error(err); }
        }, 500);
        setSearchTimeouts(prev => ({ ...prev, [index]: timeout }));
    };

    const selectLocation = (index: number, result: any) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const newStages = [...stages];
        newStages[index] = {
            ...newStages[index],
            lat,
            lng,
            title: newStages[index].title === 'Nova Paragem' || !newStages[index].title ? result.name || result.display_name.split(',')[0] : newStages[index].title
        };
        setStages(newStages);
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
        if (stage.id && !stage.id.toString().startsWith('temp')) {
            const { error } = await supabaseBrowser.from('pilgrimage_stages').delete().eq('id', stage.id);
            if (error) { toast.error('Erro ao apagar do DB'); return; }
        }
        const newStages = [...stages];
        newStages.splice(index, 1);
        setStages(newStages);
    };

    // Detailed Itinerary Helpers
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
        if (item.id && !item.id.toString().startsWith('temp')) {
            const { error } = await supabaseBrowser.from('pilgrimage_itinerary_items').delete().eq('id', item.id);
            if (error) { toast.error('Erro ao apagar do DB'); return; }
        }
        const newItems = [...detailedItems];
        newItems.splice(index, 1);
        setDetailedItems(newItems);
    };

    if (loading) return <div className="p-10 text-center flex items-center justify-center min-h-screen text-slate-500">A carregar dados...</div>;

    const toolbarActions = (
        <div className="flex items-center gap-3">
            <Toaster position="bottom-right" />
            <div className="flex items-center gap-3 mr-4">
                <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-black tracking-widest ${form.status === 'open' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {form.status}
                </span>
                {!isNew && <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-tighter">ID: {id.substring(0, 8)}...</p>}
            </div>
            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all font-bold shadow-lg shadow-indigo-100 active:scale-95 text-xs"
            >
                <Save className="w-4 h-4" />
                {saving ? '...' : 'Guardar'}
            </button>
        </div>
    );

    return (
        <AdminShell
            title={isNew ? 'Nova Peregrinação' : (form.title || 'Peregrinação')}
            showBackLink={true}
            toolbar={toolbarActions}
        >
            <div className="bg-slate-50 pb-24 min-h-screen">
                {/* Secondary Nav - Sticky */}
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-2 sticky top-0 z-30 shadow-sm overflow-x-auto no-scrollbar -mx-6 md:-mx-8">
                    <div className="flex gap-1.5 min-w-max px-6 md:px-8">
                        {[
                            { id: 'general', label: 'Informação Geral', icon: FileText },
                            { id: 'logistics', label: 'Logística & Voos', icon: Plane },
                            { id: 'pricing', label: 'Preços & Quartos', icon: Hotel },
                            { id: 'itinerary', label: 'Roteiro 3D', icon: MapPin },
                            { id: 'detailed', label: 'Itinerário Detalhado', icon: List },
                            { id: 'team', label: 'Equipa & Convidados', icon: Users },
                            { id: 'bookings', label: 'Inscrições', icon: Ticket, show: !isNew },
                            { id: 'waitlist', label: 'Lista de Espera', icon: Clock, show: !isNew }
                        ].filter(tab => tab.show !== false).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-8 py-10 w-full max-w-[1600px] mx-auto">
                    {activeTab === 'general' && <GeneralInfoTab form={form} setForm={setForm} />}
                    {activeTab === 'logistics' && <LogisticsTab form={form} setForm={setForm} />}
                    {activeTab === 'pricing' && <PricingTab form={form} setForm={setForm} />}
                    {activeTab === 'itinerary' && (
                        <ItineraryTab
                            stages={stages}
                            setStages={setStages}
                            addStage={addStage}
                            removeStage={removeStage}
                            handleLocationSearch={handleLocationSearch}
                            suggestions={suggestions}
                            selectLocation={selectLocation}
                        />
                    )}
                    {activeTab === 'detailed' && (
                        <DetailedItineraryTab
                            detailedItems={detailedItems}
                            setDetailedItems={setDetailedItems}
                            addDetailedItem={addDetailedItem}
                            removeDetailedItem={removeDetailedItem}
                        />
                    )}
                    {activeTab === 'team' && <TeamTab teamMembers={teamMembers} setTeamMembers={setTeamMembers} />}
                    {activeTab === 'bookings' && <BookingsManager pilgrimageId={id} />}
                    {activeTab === 'waitlist' && <WaitlistManager pilgrimageId={id} />}
                </div>
            </div>
        </AdminShell>
    );
}
