"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { notFound, useParams } from 'next/navigation';
import {
    Calendar,
    MapPin,
    Users,
    CheckCircle2,
    HelpCircle,
    ArrowLeft,
    Clock,
    ShieldCheck,
    Plane,
    Quote,
    Star,
    Bus,
    Hotel,
    FileText,
    X,
    Info,
    ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { parseCivilDate } from '../../../lib/utils';

// Lazy load heavy map component
const SpiritMap = dynamic(() => import('../../../components/pilgrimage/SpiritMap'), {
    ssr: false,
    loading: () => (
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 flex items-center justify-center" style={{ height: 500 }}>
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400 text-sm">A carregar mapa...</p>
            </div>
        </div>
    )
});
import UniversalStickyBar from '../../../components/pilgrimage/UniversalStickyBar';
// import ExitIntentPopup from '../../../components/pilgrimage/ExitIntentPopup'; // Removed
import { SpecificWaitlistForm } from '../../../components/pilgrimage/SpecificWaitlistForm';
import { useCurrency } from '../../../components/providers/CurrencyProvider';

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
    effective_vacancies?: number;
    base_price: number;
    status: string;
    flight_departure_time?: string;
    flight_return_time?: string;
    transport_type?: string;
    transport_description?: string;
    transport_image_url?: string;
    accommodation_rating?: string;
    accommodation_description?: string;
    included_items?: string[];
    deposit_value?: number;
    min_deposit?: number;
    pricing_config?: {
        room_supplements?: {
            single?: number;
            double?: number;
            triple?: number;
            quadruple?: number;
        };
    };
    // New fields for upgrade
    meeting_point_text?: string;
    meeting_end_text?: string;
    flight_info_text?: string;
    flight_price_from?: number;
    payment_plan_text?: string;
    cancellation_policy_text?: string;
    not_included_items?: string[];
    registration_deadline?: string;
    group_flight_details?: string;
};

type GlobalLogistics = {
    transport_title: string;
    transport_description: string;
    transport_image: string;
    accommodation_rating: string;
    accommodation_description: string;
    accommodation_image: string;
    included_items: string[];
    not_included_items?: string[];
};

type Stage = {
    id: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    image_url: string;
    display_order: number;
};

type ItineraryItem = {
    id: string;
    day_number: number;
    title: string;
    description: string;
    image_url: string;
};

type Testimonial = {
    id: string;
    author_name: string;
    role: string;
    text: string;
    image_url: string;
};

type TeamMember = {
    id: string;
    name: string;
    role: string;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    display_order: number;
};

const toSlug = (value?: string | null) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

const MOCK_FAQS = [
    { q: 'É preciso passaporte?', a: 'Para cidadãos da UE, apenas Cartão de Cidadão válido is suficiente.' },
    { q: 'O caminho é difícil?', a: 'A subida aos Pinheiros é íngreme, mas faz-se com calma. Existem acessos para quem tem mobilidade reduzida.' },
    { q: 'Como funcionam os quartos?', a: 'O preço base é para quarto partilhado (duplo). Quarto individual tem suplemento mediante disponibilidade.' }
];

export default function PilgrimageDetailPage() {
    const params = useParams();
    const { formatPrice, currency } = useCurrency();
    const slug = params.slug as string;
    const [pilgrimage, setPilgrimage] = useState<Pilgrimage | null>(null);
    const [globalLogistics, setGlobalLogistics] = useState<GlobalLogistics | null>(null);
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [stages, setStages] = useState<Stage[]>([]);
    const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
    const [existingBooking, setExistingBooking] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!slug || !supabaseBrowser) return;

            const { data: rpcData, error: pError } = await supabaseBrowser
                .rpc('get_pilgrimage_list', { p_slug: slug })
                .maybeSingle() as any;

            if (pError) console.error("❌ [RPC Error]", pError);
            let pData = rpcData;

            if (!pData) {
                const { data: fallbackRows, error: fallbackError } = await supabaseBrowser
                    .from('pilgrimages')
                    .select('*')
                    .order('start_date', { ascending: true });

                if (fallbackError) {
                    console.error("❌ [Fallback Query Error]", fallbackError);
                } else if (fallbackRows?.length) {
                    pData = fallbackRows.find((row: any) => {
                        const dbSlug = String(row?.slug || '').trim();
                        if (dbSlug && dbSlug === slug) return true;
                        // Backward compatibility: old links generated from title slug
                        // should continue to resolve even after DB slug normalization.
                        if (toSlug(row?.title) === slug) return true;
                        return false;
                    }) || null;
                }
            }

            if (pData) {
                setPilgrimage(pData);
                const { data: { user } } = await supabaseBrowser.auth.getUser();
                if (user) {
                    setUser(user);
                    const { data: bData } = await supabaseBrowser
                        .from('bookings')
                        .select('id')
                        .eq('pilgrimage_id', pData.id)
                        .eq('user_id', user.id)
                        .maybeSingle();
                    if (bData) setExistingBooking(bData.id);
                }

                const { data: cData } = await supabaseBrowser
                    .from('site_content')
                    .select('content')
                    .eq('key', 'logistics_global')
                    .single();
                if (cData) setGlobalLogistics(cData.content);

                const { data: tData } = await supabaseBrowser
                    .from('testimonials')
                    .select('*')
                    .order('display_order');
                if (tData) setTestimonials(tData);

                const { data: sData } = await supabaseBrowser
                    .from('pilgrimage_stages')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('display_order');
                if (sData) setStages(sData);

                const { data: iData } = await supabaseBrowser
                    .from('pilgrimage_itinerary_items')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('day_number');
                if (iData) setItineraryItems(iData);

                const { data: teamData } = await supabaseBrowser
                    .from('pilgrimage_team_members')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('display_order');
                if (teamData) setTeamMembers(teamData);
            }
            setLoading(false);
        };
        fetchAllData();
    }, [slug]);

    if (loading) {
        return (
            <VIPLayout allowPublic={true}>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-yellow-600 border-t-transparent rounded-full" />
                </div>
            </VIPLayout>
        );
    }

    if (!pilgrimage) {
        return (
            <VIPLayout allowPublic={true}>
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Viagem não encontrada</h1>
                    <Link href="/peregrinacoes" className="text-yellow-600 hover:underline">voltar à lista</Link>
                </div>
            </VIPLayout>
        );
    }

    const startDate = parseCivilDate(pilgrimage.start_date);
    const endDate = parseCivilDate(pilgrimage.end_date);
    const isClosed = pilgrimage.status === 'closed';
    const confirmedPax = (pilgrimage as any).confirmed_pax || 0;
    const remainingSpots = Number.isFinite(Number((pilgrimage as any).effective_vacancies))
        ? Math.max(0, Number((pilgrimage as any).effective_vacancies))
        : Number.isFinite(Number(pilgrimage.current_vacancies))
            ? Math.max(0, Number(pilgrimage.current_vacancies))
            : Math.max(0, pilgrimage.total_vacancies - confirmedPax);
    const isWaitlist = pilgrimage.status === 'waitlist' || remainingSpots <= 0;
    const includedItemsToShow =
        (pilgrimage.included_items?.length || 0) > 0
            ? (pilgrimage.included_items || [])
            : (globalLogistics?.included_items || []);
    const notIncludedItemsToShow =
        (pilgrimage.not_included_items?.length || 0) > 0
            ? (pilgrimage.not_included_items || [])
            : (globalLogistics?.not_included_items || []);

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-slate-50 min-h-screen relative pb-20">
                {/* Hero Header */}
                <div className="relative h-[60vh] w-full overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/40 z-10" />
                    {pilgrimage.cover_image && (
                        <img
                            src={pilgrimage.cover_image}
                            alt={pilgrimage.title}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 z-20 container mx-auto px-6 h-full flex flex-col justify-end pb-12">
                        <Link href="/peregrinacoes" className="inline-flex items-center text-white/80 hover:text-white mb-6 transition-colors">
                            <ArrowLeft className="w-5 h-5 mr-2" /> Voltar à lista
                        </Link>
                        <div className="flex items-center gap-3 text-yellow-300 font-bold uppercase tracking-wider text-sm mb-3">
                            <Plane className="w-5 h-5" />
                            Peregrinação Oficial
                        </div>
                        <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight shadow-sm">
                            {pilgrimage.title}
                        </h1>
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="flex wrap items-center gap-6 text-white/90 font-medium text-lg">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-yellow-400" />
                                    {format(startDate, "d 'de' MMMM", { locale: pt })} a {format(endDate, "d 'de' MMMM, yyyy", { locale: pt })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="container mx-auto px-6 -mt-10 relative z-30">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* Column Left */}
                        <div className="lg:col-span-2 space-y-12">
                            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">Sobre esta viagem</h2>
                                <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-line">{pilgrimage.description}</p>
                            </div>

                            {/* Inclusions (New Section with Global Fallback) */}
                            {(includedItemsToShow.length > 0 || notIncludedItemsToShow.length > 0) && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
                                        <CheckCircle2 className="w-6 h-6 text-yellow-600" /> O que está incluído
                                    </h2>

                                    {/* Marketing Highlight Box */}
                                    <div className="relative bg-white rounded-3xl shadow-xl border-2 border-yellow-400 overflow-hidden">
                                        {/* Badge */}
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider z-10 shadow-sm">
                                            Pacote Completo
                                        </div>

                                        <div className="p-8 md:p-10">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                {/* Included */}
                                                <div className="space-y-6">
                                                    <div>
                                                        <h3 className="font-bold text-xl text-slate-900 mb-1 flex items-center gap-2">
                                                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Tudo Incluído
                                                        </h3>
                                                        <p className="text-sm text-slate-500">Para que se preocupe apenas em rezar.</p>
                                                    </div>

                                                    <ul className="space-y-4">
                                                        {includedItemsToShow.map((item, i) => (
                                                            <li key={i} className="flex items-start gap-4 group">
                                                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0 mt-0.5 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </div>
                                                                <span className="text-slate-700 font-medium leading-tight group-hover:text-slate-900 transition-colors">{item}</span>
                                                            </li>
                                                        ))}
                                                        {/* If both empty (unlikely due to check), show empty msg */}
                                                        {includedItemsToShow.length === 0 && (
                                                            <li className="text-slate-400 italic">Detalhes brevemente.</li>
                                                        )}
                                                    </ul>
                                                </div>

                                                {/* Not Included */}
                                                <div className="space-y-6 relative">
                                                    {/* Vertical Separator for Desktop */}
                                                    <div className="hidden md:block absolute left-0 top-0 bottom-0 w-px bg-slate-100 -ml-5" />

                                                    <div>
                                                        <h3 className="font-bold text-lg text-slate-700 mb-1 flex items-center gap-2 opacity-80">
                                                            Não Incluído
                                                        </h3>
                                                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Transparência Total</p>
                                                    </div>

                                                    <ul className="space-y-3">
                                                        {notIncludedItemsToShow.length > 0 ? (
                                                            notIncludedItemsToShow.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-3 text-slate-500 text-sm leading-snug">
                                                                    <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                                                    <span>{item}</span>
                                                                </li>
                                                            ))
                                                        ) : (
                                                            <li className="text-slate-400 italic text-sm">Nada a assinalar. Tudo essencial está incluído.</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Value Props */}
                                        <div className="bg-slate-50 border-t border-slate-100 p-4 md:px-10 flex flex-wrap gap-4 md:gap-8 justify-center md:justify-start text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Sem custos ocultos</span>
                                            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Acompanhamento 24h</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Financials & Policy (New Section) */}
                            {(pilgrimage.payment_plan_text || pilgrimage.cancellation_policy_text) && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
                                        <FileText className="w-6 h-6 text-yellow-600" /> Doações e Condições
                                    </h2>
                                    <div className="grid grid-cols-1 gap-6">
                                        {pilgrimage.payment_plan_text && (
                                            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                                <div className="flex items-start gap-4 relative z-10">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <Clock className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-indigo-900 mb-2">Facilidades de Doação</h3>
                                                        <p className="text-indigo-800/80 leading-relaxed whitespace-pre-line">{pilgrimage.payment_plan_text}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {pilgrimage.cancellation_policy_text && (
                                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                                <details className="group">
                                                    <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 transition-colors">
                                                        <div className="flex items-center gap-3 font-bold text-slate-700">
                                                            <ShieldCheck className="w-5 h-5 text-slate-400" />
                                                            Política de Cancelamento
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-open:rotate-180 transition-transform">
                                                            <ArrowLeft className="w-4 h-4 -rotate-90" />
                                                        </div>
                                                    </summary>
                                                    <div className="px-6 pb-8 text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-4 bg-slate-50/30">
                                                        {pilgrimage.cancellation_policy_text}
                                                    </div>
                                                </details>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Itinerary */}
                            <div>
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-2"><Clock className="w-6 h-6 text-yellow-600" /> Roteiro Espiritual</h2>
                                {stages.length > 0 && <div className="mb-8"><SpiritMap stages={stages} height={500} /></div>}
                                <div className="space-y-6">
                                    {itineraryItems.length > 0 ? itineraryItems.map((item) => (
                                        <div key={item.id} className="flex gap-4 group">
                                            <div className="flex flex-col items-center">
                                                <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center border-4 border-white shadow-md group-hover:scale-110 transition-transform">{item.day_number}</div>
                                                <div className="w-0.5 bg-slate-200 flex-1 my-2 group-last:hidden" />
                                            </div>
                                            <div className="bg-white p-6 rounded-2xl flex-1 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                                <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                                                <p className="text-slate-600 whitespace-pre-line">{item.description}</p>
                                                {item.image_url && <div className="mt-4 rounded-xl overflow-hidden h-48 w-full"><img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /></div>}
                                            </div>
                                        </div>
                                    )) : <p className="text-slate-500 italic">Roteiro detalhado em breve.</p>}
                                </div>
                            </div>

                            {/* Detalhes Logísticos (Moved Below Itinerary) */}
                            {(pilgrimage.meeting_point_text || pilgrimage.meeting_end_text || pilgrimage.flight_info_text) && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
                                        <Plane className="w-6 h-6 text-yellow-600" /> Logística e Voos
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {pilgrimage.meeting_point_text && (
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                                <div className="flex items-center gap-2 mb-3 text-emerald-600 font-bold uppercase text-xs tracking-wider">
                                                    <MapPin className="w-4 h-4" /> Ponto de Encontro
                                                </div>
                                                <p className="text-slate-700 whitespace-pre-line leading-relaxed">{pilgrimage.meeting_point_text}</p>
                                            </div>
                                        )}
                                        {pilgrimage.meeting_end_text && (
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                                <div className="flex items-center gap-2 mb-3 text-red-500 font-bold uppercase text-xs tracking-wider">
                                                    <MapPin className="w-4 h-4" /> Fim da Viagem
                                                </div>
                                                <p className="text-slate-700 whitespace-pre-line leading-relaxed">{pilgrimage.meeting_end_text}</p>
                                            </div>
                                        )}

                                        {/* Flight Options Row */}
                                        {(pilgrimage.flight_info_text || pilgrimage.flight_price_from) && (
                                            <div className="md:col-span-2 space-y-4">
                                                <h3 className="text-lg font-bold text-slate-800">Opções de Voo</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                                    {/* Option A: Own Flight */}
                                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col">
                                                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Opção A</div>
                                                        <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold uppercase text-xs tracking-wider">
                                                            <Plane className="w-4 h-4" /> Voo Próprio
                                                        </div>
                                                        <p className="text-slate-500 text-xs mb-4 font-bold bg-slate-200/50 px-2 py-1 rounded w-fit">Flexibilidade</p>
                                                        <p className="text-slate-600 whitespace-pre-line leading-relaxed text-sm bg-white p-4 rounded-xl border border-slate-100 flex-1">
                                                            {pilgrimage.flight_info_text || "Sem informação adicional."}
                                                        </p>
                                                    </div>

                                                    {/* Option B: Group Flight */}
                                                    {pilgrimage.flight_price_from ? (
                                                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 relative overflow-hidden flex flex-col">
                                                            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Opção B</div>
                                                            <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold uppercase text-xs tracking-wider">
                                                                <Users className="w-4 h-4" /> Voo de Grupo
                                                            </div>
                                                            <p className="text-indigo-600/70 text-xs mb-6 font-bold bg-indigo-100/50 px-2 py-1 rounded w-fit">Recomendado</p>
                                                            <div className="mt-auto">
                                                                <p className="text-indigo-900/80 text-sm mb-4 font-medium leading-relaxed">
                                                                    Lugar garantido em voo organizado pela agência. Ideal para viajar acompanhado e sem preocupações.
                                                                </p>
                                                                {pilgrimage.group_flight_details && (
                                                                    <div className="mb-4 bg-white/60 p-3 rounded-lg border border-indigo-100/50 text-xs text-indigo-800 whitespace-pre-line leading-relaxed">
                                                                        {pilgrimage.group_flight_details}
                                                                    </div>
                                                                )}
                                                                <div className="bg-white p-4 rounded-xl border border-indigo-100 flex justify-between items-center shadow-sm">
                                                                    <span className="text-xs text-indigo-400 font-bold uppercase">Pagamento a partir de</span>
                                                                    <div className="text-2xl font-bold text-indigo-600">{formatPrice(pilgrimage.flight_price_from)}</div>
                                                                </div>
                                                                <p className="text-[10px] text-indigo-400 mt-2 text-center italic leading-tight">
                                                                    Nota: Este pagamento é realizado diretamente à agência de viagens parceira.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed flex items-center justify-center text-slate-400 text-sm italic">
                                                            Opção de voo de grupo não disponível.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Column Right (Sidebar) */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-24 space-y-6">
                                {/* Waitlist OR Booking Card */}
                                {isWaitlist ? (
                                    <SpecificWaitlistForm
                                        pilgrimageId={pilgrimage.id}
                                        pilgrimageTitle={pilgrimage.title}
                                    />
                                ) : (
                                    <div className="bg-white rounded-3xl p-6 shadow-2xl border border-yellow-500/10 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />
                                        <div className="mb-6 space-y-4">
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-900 font-bold">Donativo Base</span>
                                                        <span className="font-extrabold text-slate-900 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-100">{formatPrice(pilgrimage.base_price)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-900 font-bold">Taxa de Inscrição (Sinal)</span>
                                                        <span className="font-extrabold text-slate-900 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-100">{formatPrice(pilgrimage.deposit_value || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-4">
                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Valor do terrestre da viagem</p>
                                                <div className="flex items-end gap-1"><span className="text-4xl font-bold text-slate-900">{formatPrice((pilgrimage.base_price || 0) + (pilgrimage.deposit_value || 0))}</span><span className="text-slate-500 font-medium mb-1">/ pessoa</span></div>
                                                {currency === 'BRL' && (
                                                    <p className="text-[10px] text-yellow-600 font-bold mt-2 italic">* Câmbio automático para Reais</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-4 mb-8">
                                            <div className="flex justify-between py-3 border-b text-slate-600 font-medium"><span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Partida</span><span className="text-slate-900 font-bold">{format(startDate, "d MMM", { locale: pt })}</span></div>
                                            {pilgrimage.registration_deadline && (
                                                <div className="flex justify-between py-3 border-b text-slate-600 font-medium">
                                                    <span className="flex items-center gap-2 text-red-500 font-bold"><Clock className="w-4 h-4" /> Inscrições até</span>
                                                    <span className="text-red-600 font-bold">{format(parseCivilDate(pilgrimage.registration_deadline), "d MMM", { locale: pt })}</span>
                                                </div>
                                            )}
                                            {/* Vacancy Logic for UI */}
                                            <div className="flex justify-between py-3 border-b text-slate-600 font-medium">
                                                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Vagas Disponíveis</span>
                                                <span className="text-slate-900 font-bold">{remainingSpots} lugares</span>
                                            </div>
                                        </div>
                                        {isClosed ? (
                                            <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-4 rounded-xl cursor-not-allowed">Encerradas</button>
                                        ) : existingBooking ? (
                                            <Link href={`/peregrinacoes/inscricao/${existingBooking}`} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"><CheckCircle2 className="w-5 h-5" /> Gerir Inscrição</Link>
                                        ) : (
                                            <div className="space-y-3">
                                                <Link href={`/peregrinacoes/${pilgrimage.slug}/inscrever`} className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 transition-all active:scale-[0.98]">
                                                    Iniciar Inscrição <ArrowRight className="w-5 h-5" />
                                                </Link>
                                                <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    <p className="text-[11px] text-slate-500 leading-tight">
                                                        Após realizar a sua inscrição terá que realizar num prazo máximo de 5 dias úteis, o pagamento/doação do valor da inscrição para confirmar e garantir a sua inscrição.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* WhatsApp Button for Sidebar */}
                                <a
                                    href="https://wa.me/351915206815"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/10 transition-all mt-3"
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                    Falar no WhatsApp
                                </a>

                            </div>
                        </div>
                    </div>

                    {/* Portaled Components */}
                    <div className="pb-24 lg:pb-0">
                        <UniversalStickyBar
                            price={pilgrimage.base_price}
                            deposit={pilgrimage.deposit_value || pilgrimage.min_deposit || 0}
                            link={isWaitlist ? '#' : `/peregrinacoes/${pilgrimage.slug}/inscrever`}
                            isClosed={isClosed || isWaitlist}
                            pilgrimageId={pilgrimage.id}
                            slug={pilgrimage.slug}
                            buttonText={existingBooking ? 'Gerir Inscrição' : (isWaitlist ? 'Lista de Espera' : 'Iniciar Inscrição')}
                            depositValue={pilgrimage.deposit_value || 0}
                        />
                    </div>
                </div>
            </div>
            {/* ExitIntentPopup Removed */}
        </VIPLayout >
    );
}
