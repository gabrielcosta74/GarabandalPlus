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
    Clock,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    Eye
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
import PreviewTab from './components/PreviewTab';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { serializeCivilDateForStorage } from '../../../../lib/utils';
import type { CountryBasedFlightPolicy } from '../../../../lib/pilgrimage-flight-policy';

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
    manual_occupied_pax?: number;
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
    flight_price_from?: number;
    group_flight_details?: string;
    payment_plan_text?: string;
    cancellation_policy_text?: string;
    not_included_items?: string[];
    itinerary_summary?: string;
    registration_deadline?: string;
    // Pricing Config (JSONB)
    pricing_config: {
        room_supplements?: {
            single?: number;
            double?: number;
            triple?: number;
            quadruple?: number;
        };
        flight_registration_policy?: CountryBasedFlightPolicy | null;
        installment_deadline?: string | null;
    } | null;
    // EN translations
    title_en?: string | null;
    description_en?: string | null;
    itinerary_summary_en?: string | null;
    meeting_point_text_en?: string | null;
    meeting_end_text_en?: string | null;
    flight_info_text_en?: string | null;
    payment_plan_text_en?: string | null;
    cancellation_policy_text_en?: string | null;
    transport_description_en?: string | null;
    accommodation_description_en?: string | null;
    included_items_en?: string[] | null;
    not_included_items_en?: string[] | null;
    group_flight_details_en?: string | null;
};

type DetailedItineraryItem = {
    id?: string;
    pilgrimage_id?: string;
    day_number: number | null;
    title: string | null;
    title_en?: string | null;
    description: string | null;
    description_en?: string | null;
    image_url: string | null;
    display_order: number | null;
};

type TeamMember = {
    id?: string;
    pilgrimage_id?: string;
    name: string;
    role: string;
    role_en?: string | null;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    description_en?: string | null;
    display_order: number;
};

const TABS = [
    { id: 'general', label: 'Informação Geral', icon: FileText, description: 'Títulos, datas e descrição' },
    { id: 'preview', label: 'Pré-visualização', icon: Eye, show: (isNew: boolean) => !isNew, description: 'Ver a página antes de publicar' },
    { id: 'logistics', label: 'Logística', icon: Plane, description: 'Voos e alojamento' },
    { id: 'pricing', label: 'Preços', icon: Hotel, description: 'Valores e suplementos' },
    { id: 'itinerary', label: 'Roteiro 3D', icon: MapPin, description: 'Mapa interativo' },
    { id: 'detailed', label: 'Itinerário', icon: List, description: 'Dia a dia detalhado' },
    { id: 'team', label: 'Equipa', icon: Users, description: 'Guias e convidados' },
    { id: 'bookings', label: 'Inscrições', icon: Ticket, show: (isNew: boolean) => !isNew, description: 'Gestão de passageiros' },
    { id: 'waitlist', label: 'Lista de Espera', icon: Clock, show: (isNew: boolean) => !isNew, description: 'Gestão de interessados' }
];

export default function PilgrimageEditorPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const isNew = id === 'nova';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    // State
    const [form, setForm] = useState<Partial<Pilgrimage>>({
        title: '',
        slug: '',
        description: '',
        base_price: 0,
        total_vacancies: 0,
        current_vacancies: 0,
        manual_occupied_pax: 0,
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
    const [detailedItems, setDetailedItems] = useState<DetailedItineraryItem[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // Search Suggestions State (for Itinerary)
    const [suggestions, setSuggestions] = useState<Record<number, any[]>>({});
    const [searchTimeouts, setSearchTimeouts] = useState<Record<number, NodeJS.Timeout>>({});
    const uuidV4LikeRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = (value: unknown) => typeof value === 'string' && uuidV4LikeRegex.test(value);
    const normalizeText = (value: unknown) => (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
    const normalizeCoordinate = (value: unknown) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '';
        return num.toFixed(6);
    };
    const makeUuid = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

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

    const syncVacanciesFromServer = async (pilgrimageId: string) => {
        if (!supabaseBrowser) return null;
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return null;

        const res = await fetch(`/api/admin/pilgrimages/${pilgrimageId}/vacancies`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body?.error || 'Erro ao recalcular vagas');
        }
        return body?.vacancies || null;
    };

    const handleSave = async () => {
        if (!supabaseBrowser) { toast.error('Erro de configuração Supabase'); return; }
        setSaving(true);
        try {
            let pid = id;

            // 1. Upsert Pilgrimage
            const payload = { ...form };
            if (isNew) delete (payload as any).id;
            (payload as any).start_date = serializeCivilDateForStorage(payload.start_date);
            (payload as any).end_date = serializeCivilDateForStorage(payload.end_date);
            (payload as any).registration_deadline = serializeCivilDateForStorage(payload.registration_deadline);

            const { data, error } = await supabaseBrowser
                .from('pilgrimages')
                .upsert(isNew ? [payload] : [{ ...payload, id }])
                .select()
                .single();

            if (error) throw error;
            pid = data.id;

            const syncedVacancies = await syncVacanciesFromServer(pid);
            if (syncedVacancies) {
                setForm((prev) => ({
                    ...prev,
                    total_vacancies: Number(syncedVacancies.total_vacancies ?? prev.total_vacancies ?? 0),
                    current_vacancies: Number(syncedVacancies.current_vacancies ?? prev.current_vacancies ?? 0),
                    manual_occupied_pax: Number(syncedVacancies.manual_occupied_pax ?? prev.manual_occupied_pax ?? 0),
                }));
            }

            // 2. Sync Stages
            const stageSeen = new Set<string>();
            const uniqueStages = stages
                .map((stage, index) => ({
                    id: isUuid(stage.id) ? stage.id : makeUuid(),
                    pilgrimage_id: pid,
                    title: (stage.title ?? '').toString(),
                    description: (stage.description ?? '').toString(),
                    lat: Number.isFinite(Number(stage.lat)) ? Number(stage.lat) : 0,
                    lng: Number.isFinite(Number(stage.lng)) ? Number(stage.lng) : 0,
                    image_url: (stage.image_url ?? '').toString(),
                    display_order: index + 1,
                }))
                .filter((stage) => {
                    const key = [
                        normalizeText(stage.title),
                        normalizeText(stage.description),
                        normalizeText(stage.image_url),
                        normalizeCoordinate(stage.lat),
                        normalizeCoordinate(stage.lng),
                    ].join('|');
                    if (stageSeen.has(key)) return false;
                    stageSeen.add(key);
                    return true;
                })
                .map((stage, index) => ({ ...stage, display_order: index + 1 }));

            const stageIdsToKeep = uniqueStages.map((s) => s.id);
            const { data: existingStageRows } = await supabaseBrowser
                .from('pilgrimage_stages')
                .select('id')
                .eq('pilgrimage_id', pid);

            const existingStageIds = (existingStageRows || []).map((row: any) => row.id).filter(Boolean);
            const stageIdsToDelete = existingStageIds.filter((existingId: string) => !stageIdsToKeep.includes(existingId));
            if (stageIdsToDelete.length > 0) {
                await supabaseBrowser.from('pilgrimage_stages').delete().in('id', stageIdsToDelete);
            }

            if (uniqueStages.length > 0) {
                await supabaseBrowser.from('pilgrimage_stages').upsert(uniqueStages, { onConflict: 'id' });
            }
            setStages(uniqueStages);

            // 3. Sync Detailed Itinerary
            const itinerarySeen = new Set<string>();
            const uniqueDetailedItems = detailedItems
                .map((item, index) => {
                    const parsedDay = Number(item.day_number);
                    const safeDay = Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : index + 1;
                    return {
                        id: isUuid(item.id) ? item.id : makeUuid(),
                        pilgrimage_id: pid,
                        day_number: safeDay,
                        title: (item.title ?? '').toString(),
                        title_en: (item.title_en ?? '').toString(),
                        description: (item.description ?? '').toString(),
                        description_en: (item.description_en ?? '').toString(),
                        image_url: (item.image_url ?? '').toString(),
                        display_order: index + 1,
                    };
                })
                .filter((item) => {
                    const key = [
                        item.day_number,
                        normalizeText(item.title),
                        normalizeText(item.description),
                        normalizeText(item.image_url),
                    ].join('|');
                    if (itinerarySeen.has(key)) return false;
                    itinerarySeen.add(key);
                    return true;
                })
                .map((item, index) => ({ ...item, display_order: index + 1 }));

            const itineraryIdsToKeep = uniqueDetailedItems.map((item) => item.id);
            const { data: existingItineraryRows } = await supabaseBrowser
                .from('pilgrimage_itinerary_items')
                .select('id')
                .eq('pilgrimage_id', pid);

            const existingItineraryIds = (existingItineraryRows || []).map((row: any) => row.id).filter(Boolean);
            const itineraryIdsToDelete = existingItineraryIds.filter((existingId: string) => !itineraryIdsToKeep.includes(existingId));
            if (itineraryIdsToDelete.length > 0) {
                await supabaseBrowser.from('pilgrimage_itinerary_items').delete().in('id', itineraryIdsToDelete);
            }

            if (uniqueDetailedItems.length > 0) {
                await supabaseBrowser.from('pilgrimage_itinerary_items').upsert(uniqueDetailedItems, { onConflict: 'id' });
            }
            setDetailedItems(uniqueDetailedItems);

            // 4. Sync Team
            const teamSeen = new Set<string>();
            const uniqueTeamMembers = teamMembers
                .map((member, index) => ({
                    id: isUuid(member.id) ? member.id : makeUuid(),
                    pilgrimage_id: pid,
                    name: (member.name ?? '').toString(),
                    role: (member.role ?? '').toString(),
                    role_en: (member.role_en ?? '').toString(),
                    country: (member.country ?? '').toString().toUpperCase(),
                    image_url: (member.image_url ?? '').toString(),
                    is_special_guest: Boolean(member.is_special_guest),
                    description: (member.description ?? '').toString(),
                    description_en: (member.description_en ?? '').toString(),
                    display_order: index + 1,
                }))
                .filter((member) => {
                    const key = [
                        normalizeText(member.name),
                        normalizeText(member.role),
                        normalizeText(member.country),
                        normalizeText(member.description),
                        normalizeText(member.image_url),
                        member.is_special_guest ? '1' : '0',
                    ].join('|');
                    if (teamSeen.has(key)) return false;
                    teamSeen.add(key);
                    return true;
                })
                .map((member, index) => ({ ...member, display_order: index + 1 }));

            const teamIdsToKeep = uniqueTeamMembers.map((member) => member.id);
            const { data: existingTeamRows } = await supabaseBrowser
                .from('pilgrimage_team_members')
                .select('id')
                .eq('pilgrimage_id', pid);

            const existingTeamIds = (existingTeamRows || []).map((row: any) => row.id).filter(Boolean);
            const teamIdsToDelete = existingTeamIds.filter((existingId: string) => !teamIdsToKeep.includes(existingId));
            if (teamIdsToDelete.length > 0) {
                await supabaseBrowser.from('pilgrimage_team_members').delete().in('id', teamIdsToDelete);
            }

            if (uniqueTeamMembers.length > 0) {
                await supabaseBrowser.from('pilgrimage_team_members').upsert(uniqueTeamMembers, { onConflict: 'id' });
            }
            setTeamMembers(uniqueTeamMembers);

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
            title_en: '',
            description: '',
            description_en: '',
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

    const handleNextTab = () => {
        const availableTabs = TABS.filter(t => !t.show || t.show(isNew));
        const currentIndex = availableTabs.findIndex(t => t.id === activeTab);
        if (currentIndex < availableTabs.length - 1) {
            setActiveTab(availableTabs[currentIndex + 1].id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrevTab = () => {
        const availableTabs = TABS.filter(t => !t.show || t.show(isNew));
        const currentIndex = availableTabs.findIndex(t => t.id === activeTab);
        if (currentIndex > 0) {
            setActiveTab(availableTabs[currentIndex - 1].id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-400 font-medium animate-pulse">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                A carregar dados da peregrinação...
            </div>
        </div>
    );

    const activeTabIndex = TABS.filter(t => !t.show || t.show(isNew)).findIndex(t => t.id === activeTab);
    const isLastTab = activeTabIndex === TABS.filter(t => !t.show || t.show(isNew)).length - 1;
    const isFirstTab = activeTabIndex === 0;

    const toolbarActions = (
        <div className="flex items-center gap-3">
            <Toaster position="bottom-right" />
            <div className="flex items-center gap-3 mr-4">
                <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-black tracking-widest ${form.status === 'open' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {form.status}
                </span>
                {!isNew && <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-tighter">ID: {id.substring(0, 8)}...</p>}
            </div>
            {!isNew && (
                <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 border border-indigo-200 bg-indigo-50 text-indigo-700 px-4 py-3 sm:py-2.5 rounded-xl hover:bg-indigo-100 transition-all font-bold text-xs"
                >
                    <Eye className="w-4 h-4" />
                    Pré-visualizar
                </button>
            )}
            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all font-bold shadow-lg shadow-indigo-200 active:scale-95 text-xs group"
            >
                {saving ? (
                    'A Guardar...'
                ) : (
                    <>
                        <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Guardar Alterações
                    </>
                )}
            </button>
        </div>
    );

    return (
        <AdminShell
            title={isNew ? 'Nova Peregrinação' : (form.title || 'Peregrinação')}
            showBackLink={true}
            toolbar={toolbarActions}
        >
            <div className="bg-slate-50 min-h-screen pb-32">
                {/* 1. Styled Tab Navigation */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                    <div className="w-full max-w-[1600px] mx-auto px-6 overflow-x-auto no-scrollbar">
                        <div className="flex gap-2 min-w-max py-4">
                            {TABS.filter(tab => !tab.show || tab.show(isNew)).map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all
                                            ${isActive ? 'text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}
                                        `}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute inset-0 bg-slate-900 rounded-full shadow-lg shadow-slate-200"
                                                initial={false}
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-2">
                                            <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} />
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2. Content Area with Transitions */}
                <main className="px-6 py-8 w-full max-w-[1600px] mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className={activeTab === 'preview'
                                ? 'min-h-[400px]'
                                : 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]'
                            }
                        >
                            {/* Tab Header (Purely Visual) */}
                            {activeTab !== 'preview' && <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                        {(() => {
                                            const t = TABS.find(t => t.id === activeTab);
                                            const Icon = t?.icon || FileText;
                                            return (
                                                <>
                                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    {t?.label}
                                                </>
                                            );
                                        })()}
                                    </h2>
                                    <p className="text-slate-400 text-xs mt-1 ml-14">
                                        {TABS.find(t => t.id === activeTab)?.description}
                                    </p>
                                </div>
                            </div>}

                            <div className={activeTab === 'preview' ? 'p-0' : 'p-4 md:p-8'}>
                                {activeTab === 'general' && <GeneralInfoTab form={form} setForm={setForm} />}
                                {activeTab === 'preview' && (
                                    <PreviewTab
                                        pilgrimageId={id}
                                        status={form.status}
                                        slug={form.slug}
                                        saving={saving}
                                        onSave={handleSave}
                                    />
                                )}
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

                            {/* 3. Footer Navigation */}
                            {activeTab !== 'preview' && <div className="p-3 md:p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center sticky bottom-0 gap-2">
                                <button
                                    onClick={handlePrevTab}
                                    disabled={isFirstTab}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
                                        ${isFirstTab ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-sm'}
                                    `}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Anterior
                                </button>

                                <div className="flex items-center gap-2">
                                    {/* Optional quick save in footer */}
                                    <button
                                        onClick={handleSave}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        Guardar Rascunho
                                    </button>

                                    {!isLastTab ? (
                                        <button
                                            onClick={handleNextTab}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-xs shadow-md shadow-slate-200 active:scale-95"
                                        >
                                            Próximo Passo
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSave}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold text-xs shadow-lg shadow-green-200 active:scale-95"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Finalizar Edição
                                        </button>
                                    )}
                                </div>
                            </div>}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </AdminShell>
    );
}
