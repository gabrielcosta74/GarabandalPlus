"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useParams, useSearchParams } from 'next/navigation';
import {
    Calendar,
    Users,
    CheckCircle2,
    ArrowLeft,
    Clock,
    ShieldCheck,
    Plane,
    ArrowRight,
    Star,
    AlertTriangle,
    Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { getAvailabilityHighlightLabel, isNovemberCampaignPilgrimage, parseCivilDate } from '../../../lib/utils';
import PilgrimageInfoModal from '../../../components/pilgrimage/PilgrimageInfoModal';
import PilgrimagePaymentWarningModal from '../../../components/pilgrimage/PilgrimagePaymentWarningModal';
import { useLocale } from '../../../contexts/LocaleContext';

// Lazy load heavy map component
const SpiritMap = dynamic(() => import('../../../components/pilgrimage/SpiritMap'), {
    ssr: false,
    loading: () => {
        const isEnLoad = typeof window !== 'undefined' && (window.location.pathname === '/en' || window.location.pathname.startsWith('/en/'));
        return (
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 flex items-center justify-center" style={{ height: 500 }}>
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400 text-sm">{isEnLoad ? 'Loading map...' : 'A carregar mapa...'}</p>
                </div>
            </div>
        );
    }
});
import UniversalStickyBar from '../../../components/pilgrimage/UniversalStickyBar';
// import ExitIntentPopup from '../../../components/pilgrimage/ExitIntentPopup'; // Removed
import { SpecificWaitlistForm } from '../../../components/pilgrimage/SpecificWaitlistForm';
import { useCurrency } from '../../../components/providers/CurrencyProvider';
import { PilgrimagePrice } from '../../../components/pilgrimage/PilgrimagePrice';
import ChatWidget from '../../../components/pilgrimage/ChatWidget';
import {
    CountryBasedFlightPolicy,
    getCountryBasedFlightPolicy,
} from '../../../lib/pilgrimage-flight-policy';
import {
    getConfiguredInstallmentDeadline,
    getMaxInstallments,
} from '../../../lib/pilgrimage-installments';

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
    confirmed_pax?: number;
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
        flight_registration_policy?: CountryBasedFlightPolicy | null;
        installment_deadline?: string | null;
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

type GlobalLogistics = {
    transport_title: string;
    transport_title_en?: string | null;
    transport_description: string;
    transport_description_en?: string | null;
    transport_image: string;
    accommodation_rating: string;
    accommodation_rating_en?: string | null;
    accommodation_description: string;
    accommodation_description_en?: string | null;
    accommodation_image: string;
    included_items: string[];
    included_items_en?: string[] | null;
    not_included_items?: string[];
    not_included_items_en?: string[] | null;
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
    title_en?: string | null;
    description: string;
    description_en?: string | null;
    image_url: string;
};

type TeamMember = {
    id: string;
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

const toSlug = (value?: string | null) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

export default function PilgrimageDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { currency } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const listPath = isEn ? '/en/pilgrimages' : '/peregrinacoes';
    const slug = params.slug as string;
    const previewId = searchParams.get('previewId');
    const isAdminPreview = Boolean(previewId);
    const [pilgrimage, setPilgrimage] = useState<Pilgrimage | null>(null);
    const [globalLogistics, setGlobalLogistics] = useState<GlobalLogistics | null>(null);
    const [stages, setStages] = useState<Stage[]>([]);
    const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
    const [existingBooking, setExistingBooking] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeInfoModal, setActiveInfoModal] = useState<'included' | 'flights' | null>(null);
    const [isPaymentWarningOpen, setIsPaymentWarningOpen] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!slug || !supabaseBrowser) return;

            if (previewId) {
                const { data: sessionData } = await supabaseBrowser.auth.getSession();
                const token = sessionData.session?.access_token;
                if (!token) {
                    setLoading(false);
                    return;
                }

                const previewResponse = await fetch(
                    `/api/admin/pilgrimages/${encodeURIComponent(previewId)}/preview`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        cache: 'no-store',
                    },
                );
                if (!previewResponse.ok) {
                    setLoading(false);
                    return;
                }

                const previewData = await previewResponse.json();
                setPilgrimage(previewData.pilgrimage as Pilgrimage);
                setGlobalLogistics(previewData.globalLogistics as GlobalLogistics | null);
                setStages((previewData.stages || []) as Stage[]);
                setItineraryItems((previewData.itineraryItems || []) as ItineraryItem[]);
                setTeamMembers((previewData.teamMembers || []) as TeamMember[]);
                setExistingBooking(null);
                setLoading(false);
                return;
            }

            const { data: rpcData, error: pError } = await supabaseBrowser
                .rpc('get_pilgrimage_list', { p_slug: slug })
                .maybeSingle() as { data: Pilgrimage | null; error: { message?: string } | null };

            if (pError) console.error("❌ [RPC Error]", pError);
            let pData: Pilgrimage | null = rpcData?.status === 'draft' ? null : rpcData;

            if (!pData) {
                const { data: fallbackRows, error: fallbackError } = await supabaseBrowser
                    .from('pilgrimages')
                    .select('*')
                    .order('start_date', { ascending: true });

                if (fallbackError) {
                    console.error("❌ [Fallback Query Error]", fallbackError);
                } else if (fallbackRows?.length) {
                    pData = (fallbackRows as Pilgrimage[]).find((row) => {
                        if (row.status === 'draft') return false;
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
    }, [previewId, slug]);

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
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{isEn ? 'Trip not found' : 'Viagem não encontrada'}</h1>
                    <Link href={listPath} className="text-yellow-600 hover:underline">{isEn ? 'back to list' : 'voltar à lista'}</Link>
                </div>
            </VIPLayout>
        );
    }

    const startDate = parseCivilDate(pilgrimage.start_date);
    const endDate = parseCivilDate(pilgrimage.end_date);
    const dateLocale = isEn ? enUS : pt;
    const longDateFmt = isEn ? "MMMM d" : "d 'de' MMMM";
    const longDateWithYearFmt = isEn ? "MMMM d, yyyy" : "d 'de' MMMM, yyyy";
    const shortDateFmt = isEn ? "MMM d" : "d MMM";
    const dateRangeSep = isEn ? 'to' : 'a';
    const isClosed = pilgrimage.status === 'closed';
    const confirmedPax = pilgrimage.confirmed_pax || 0;
    const remainingSpots = Number.isFinite(Number(pilgrimage.effective_vacancies))
        ? Math.max(0, Number(pilgrimage.effective_vacancies))
        : Number.isFinite(Number(pilgrimage.current_vacancies))
            ? Math.max(0, Number(pilgrimage.current_vacancies))
            : Math.max(0, pilgrimage.total_vacancies - confirmedPax);
    const isWaitlist = pilgrimage.status === 'waitlist' || remainingSpots <= 0;
    const includedItemsToShow =
        isEn && (pilgrimage.included_items_en?.length || 0) > 0
            ? (pilgrimage.included_items_en || [])
            : (pilgrimage.included_items?.length || 0) > 0
                ? (pilgrimage.included_items || [])
            : isEn && (globalLogistics?.included_items_en?.length || 0) > 0
                ? (globalLogistics?.included_items_en || [])
            : (globalLogistics?.included_items || []);
    const notIncludedItemsToShow =
        isEn && (pilgrimage.not_included_items_en?.length || 0) > 0
            ? (pilgrimage.not_included_items_en || [])
            : (pilgrimage.not_included_items?.length || 0) > 0
                ? (pilgrimage.not_included_items || [])
            : isEn && (globalLogistics?.not_included_items_en?.length || 0) > 0
                ? (globalLogistics?.not_included_items_en || [])
            : (globalLogistics?.not_included_items || []);
    const hasIncludedInfo = includedItemsToShow.length > 0 || notIncludedItemsToShow.length > 0;
    const flightInfoTextToShow = isEn ? pilgrimage.flight_info_text_en || pilgrimage.flight_info_text : pilgrimage.flight_info_text;
    const groupFlightDetailsToShow = isEn ? pilgrimage.group_flight_details_en || pilgrimage.group_flight_details : pilgrimage.group_flight_details;
    const meetingPointTextToShow = isEn ? pilgrimage.meeting_point_text_en || pilgrimage.meeting_point_text : pilgrimage.meeting_point_text;
    const meetingEndTextToShow = isEn ? pilgrimage.meeting_end_text_en || pilgrimage.meeting_end_text : pilgrimage.meeting_end_text;
    const paymentPlanTextToShow = isEn ? pilgrimage.payment_plan_text_en || pilgrimage.payment_plan_text : pilgrimage.payment_plan_text;
    const cancellationPolicyTextToShow = isEn ? pilgrimage.cancellation_policy_text_en || pilgrimage.cancellation_policy_text : pilgrimage.cancellation_policy_text;
    const countryBasedFlightPolicy = getCountryBasedFlightPolicy(pilgrimage);
    const installmentDeadline = getConfiguredInstallmentDeadline(pilgrimage);
    const publicMaxInstallments = installmentDeadline
        ? getMaxInstallments(pilgrimage.start_date, installmentDeadline)
        : 8;
    const hasFlightInfo = Boolean(
        countryBasedFlightPolicy ||
        flightInfoTextToShow ||
        pilgrimage.flight_price_from ||
        groupFlightDetailsToShow ||
        meetingPointTextToShow ||
        meetingEndTextToShow
    );
    const registrationLink = isAdminPreview
        ? '#'
        : existingBooking
            ? (isEn ? `/en/pilgrimages/registration/${existingBooking}` : `/peregrinacoes/inscricao/${existingBooking}`)
            : (isEn ? `/en/pilgrimages/${pilgrimage.slug}/register` : `/peregrinacoes/${pilgrimage.slug}/inscrever`);
    const shouldWarnBeforeRegistration = !isAdminPreview && !isClosed && !existingBooking && !isWaitlist;

    const accommodationRatingToShow = pilgrimage.accommodation_rating || (isEn ? globalLogistics?.accommodation_rating_en || globalLogistics?.accommodation_rating : globalLogistics?.accommodation_rating) || '';
    const accommodationDescriptionToShow = isEn
        ? pilgrimage.accommodation_description_en || pilgrimage.accommodation_description || globalLogistics?.accommodation_description_en || globalLogistics?.accommodation_description || ''
        : pilgrimage.accommodation_description || globalLogistics?.accommodation_description || '';
    const transportTypeToShow = pilgrimage.transport_type || (isEn ? globalLogistics?.transport_title_en || globalLogistics?.transport_title : globalLogistics?.transport_title) || '';
    const transportDescriptionToShow = isEn
        ? pilgrimage.transport_description_en || pilgrimage.transport_description || globalLogistics?.transport_description_en || globalLogistics?.transport_description || ''
        : pilgrimage.transport_description || globalLogistics?.transport_description || '';
    const pilgrimageTitle = isEn ? pilgrimage.title_en || pilgrimage.title : pilgrimage.title;
    const pilgrimageDescription = isEn ? pilgrimage.description_en || pilgrimage.description : pilgrimage.description;
    const isNovemberCampaign = isNovemberCampaignPilgrimage(pilgrimage);

    return (
        <VIPLayout allowPublic={true}>
            <div className="-mx-4 bg-slate-50 min-h-screen relative pb-20 md:mx-0">
                {isAdminPreview && (
                    <div className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider text-amber-950 shadow-sm">
                        <Eye className="h-4 w-4" />
                        Pré-visualização privada · rascunho não publicado
                    </div>
                )}
                {/* Hero Header */}
                <div className="relative min-h-[560px] w-full overflow-hidden md:h-[68vh] md:min-h-[620px]">
                    <div className="absolute inset-0 bg-slate-950/35 z-10" />
                    {pilgrimage.cover_image && (
                        <img
                            src={pilgrimage.cover_image}
                            alt={pilgrimageTitle}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/75 via-slate-950/25 to-transparent" />
                    <div className="absolute inset-0 z-20 container mx-auto px-4 md:px-6 h-full flex flex-col justify-end pb-8 md:pb-12">
                        <Link
                            href={isAdminPreview && previewId ? `/admin/peregrinacoes/${previewId}` : listPath}
                            className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                        >
                            <ArrowLeft className="w-4 h-4" /> {isAdminPreview ? 'Voltar ao editor' : (isEn ? 'Back to list' : 'Voltar à lista')}
                        </Link>
                        <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-yellow-300 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-950 shadow-lg">
                            <Plane className="w-4 h-4" />
                            <Star className="w-3.5 h-3.5 fill-slate-950" />
                            {isEn ? 'Official Pilgrimage' : 'Peregrinação Oficial'}
                        </div>
                        <div className="max-w-4xl rounded-3xl border border-white/10 bg-slate-950/30 p-4 shadow-2xl backdrop-blur-sm md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0 md:border-0">
                            <h1 className="text-3xl sm:text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight drop-shadow-xl">
                                {pilgrimageTitle}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 text-white font-semibold text-base md:text-lg">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 backdrop-blur-md">
                                    <Calendar className="w-5 h-5 text-yellow-300" />
                                    <span>{format(startDate, longDateFmt, { locale: dateLocale })} {dateRangeSep} {format(endDate, longDateWithYearFmt, { locale: dateLocale })}</span>
                                </span>
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black uppercase tracking-wide ${
                                    isNovemberCampaign
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-950/25 ring-2 ring-white/80'
                                        : 'bg-emerald-400/95 text-emerald-950'
                                }`}>
                                    {isNovemberCampaign ? <AlertTriangle className="h-4 w-4" /> : null}
                                    <Users className="h-4 w-4" />
                                    {isClosed ? (isEn ? 'Closed' : 'Encerradas') : isWaitlist ? (isEn ? 'Waiting List' : 'Lista de Espera') : getAvailabilityHighlightLabel(remainingSpots, locale, pilgrimage)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="container mx-auto px-0 md:px-6 -mt-8 md:-mt-10 relative z-30">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
                        {/* Column Left */}
                        <div className="lg:col-span-2 space-y-10 md:space-y-12">
                            <div className="bg-white rounded-none p-5 shadow-xl border-y border-slate-100 md:rounded-3xl md:border md:p-8">
                                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-yellow-700">
                                    <ShieldCheck className="h-4 w-4" />
                                    {isEn ? 'Programme and mission' : 'Programa e missão'}
                                </div>
                                <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4">{isEn ? 'About this pilgrimage' : 'Sobre esta peregrinação'}</h2>
                                <p className="text-slate-700 text-base md:text-lg leading-8 whitespace-pre-line">{pilgrimageDescription}</p>
                                <div className="mt-8 border-t border-slate-100 pt-6">
                                    <h3 className="font-serif text-xl font-bold text-slate-950">
                                        {isEn ? 'A Catholic Marian pilgrimage with spiritual guidance' : 'Uma peregrinação mariana católica com acompanhamento espiritual'}
                                    </h3>
                                    <p className="mt-3 text-base leading-7 text-slate-600">
                                        {isEn
                                            ? 'This programme is prepared for pilgrims who want to live Garabandal, Fatima and the Catholic shrines of the Iberian route with prayer, community and clear organisation before registration.'
                                            : 'Este programa é preparado para peregrinos que desejam viver Garabandal, Fátima e os santuários católicos do percurso ibérico com oração, comunidade e organização clara antes da inscrição.'}
                                    </p>
                                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                        {[
                                            isEn ? 'Marian devotion' : 'Devoção mariana',
                                            isEn ? 'Catholic itinerary' : 'Roteiro católico',
                                            isEn ? 'Organised registration' : 'Inscrição organizada',
                                        ].map((item) => (
                                            <div key={item} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Equipa da Peregrinação */}
                            {teamMembers.length > 0 && (
                                <div>
                                    <h2 className="px-5 text-2xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-2 md:px-0">
                                        <Users className="w-6 h-6 text-yellow-600" /> {isEn ? 'Pilgrimage Team' : 'Equipa da Peregrinação'}
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 md:gap-6">
                                        {teamMembers.map((member) => (
                                            <div key={member.id} className="bg-white rounded-none p-5 shadow-sm border-y border-slate-100 flex gap-4 items-start hover:shadow-md transition-shadow md:rounded-2xl md:border">
                                                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-slate-100 border-2 border-yellow-100">
                                                    {member.image_url ? (
                                                        <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                            <Users className="w-8 h-8 opacity-50" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <h3 className="font-bold text-slate-900 text-base leading-tight">{member.name}</h3>
                                                        {member.is_special_guest && (
                                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase tracking-wider rounded-full shrink-0">{isEn ? 'Guest' : 'Convidado'}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-yellow-600 mb-2">{(isEn ? member.role_en || member.role : member.role)} • {member.country}</p>
                                                    {(isEn ? member.description_en || member.description : member.description) && (
                                                        <p className="text-sm text-slate-600 leading-relaxed text-balance">{isEn ? member.description_en || member.description : member.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Itinerary */}
                            <div className="rounded-none bg-white p-5 shadow-xl border-y border-slate-100 md:rounded-[2rem] md:border md:p-8">
                                <div className="mb-6">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-yellow-700">
                                        <Clock className="w-4 h-4" />
                                        {isEn ? 'Day by day' : 'Dia a dia'}
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">{isEn ? 'Spiritual Itinerary' : 'Roteiro Espiritual'}</h2>
                                    <p className="mt-2 text-sm md:text-base leading-relaxed text-slate-500">
                                        {isEn ? 'A simple view of the journey, organised for quick reading on mobile.' : 'Uma leitura simples do caminho, organizada para ser fácil de acompanhar no telemóvel.'}
                                    </p>
                                </div>
                                {stages.length > 0 && <div className="mb-8 overflow-hidden rounded-2xl"><SpiritMap stages={stages} height={360} /></div>}
                                <div className="space-y-4 md:space-y-5">
                                    {itineraryItems.length > 0 ? itineraryItems.map((item) => (
                                        <div key={item.id} className="group overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 shadow-sm transition-all hover:border-yellow-200 hover:bg-white hover:shadow-md">
                                            {item.image_url && (
                                                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 md:hidden">
                                                    <img src={item.image_url} alt={isEn ? item.title_en || item.title : item.title} className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.02]" />
                                                    <div className="absolute left-4 top-4 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
                                                        {isEn ? `Day ${item.day_number}` : `Dia ${item.day_number}`}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex gap-4 p-4 md:p-5">
                                                <div className="hidden md:flex flex-col items-center">
                                                    <div className="w-11 h-11 rounded-2xl bg-yellow-100 text-yellow-800 font-black flex items-center justify-center border border-yellow-200 shadow-sm group-hover:scale-105 transition-transform">{item.day_number}</div>
                                                    <div className="w-0.5 bg-slate-200 flex-1 my-2 group-last:hidden" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    {!item.image_url && (
                                                        <div className="mb-2 flex items-center gap-2 md:hidden">
                                                        <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-yellow-800">
                                                            {isEn ? `Day ${item.day_number}` : `Dia ${item.day_number}`}
                                                        </span>
                                                        </div>
                                                    )}
                                                    <h3 className="font-serif font-bold text-slate-950 text-xl leading-tight mb-2">{isEn ? item.title_en || item.title : item.title}</h3>
                                                    <p className="text-slate-600 text-base leading-7 whitespace-pre-line">{isEn ? item.description_en || item.description : item.description}</p>
                                                    {item.image_url && <div className="mt-4 hidden md:block rounded-xl overflow-hidden aspect-[16/9] w-full bg-slate-100"><img src={item.image_url} alt={isEn ? item.title_en || item.title : item.title} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.02]" /></div>}
                                                </div>
                                            </div>
                                        </div>
                                    )) : <p className="text-slate-500 italic">{isEn ? 'Detailed itinerary coming soon.' : 'Roteiro detalhado em breve.'}</p>}
                                </div>
                            </div>


                        </div>

                        {/* Column Right (Sidebar) */}
                        <div className="md:px-0 lg:col-span-1">
                            <div className="sticky top-24 space-y-6">
                                {/* Waitlist OR Booking Card */}
                                {isWaitlist ? (
                                    <SpecificWaitlistForm
                                        pilgrimageId={pilgrimage.id}
                                        pilgrimageTitle={pilgrimageTitle}
                                    />
                                ) : (
                                    <div className="bg-white rounded-none shadow-2xl border-y border-yellow-500/10 relative overflow-hidden md:rounded-3xl md:border">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />

                                        {/* Price block */}
                                        <div className="px-5 pt-6 pb-4 border-b border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                                                {isEn ? 'Land package · flights not included' : 'Terrestre · voo não incluído'}
                                            </p>
                                            <PilgrimagePrice
                                                amountInEur={(pilgrimage.base_price || 0) + (pilgrimage.deposit_value || 0)}
                                                layout="stacked"
                                                primaryClassName="text-4xl font-black"
                                                secondaryClassName="text-2xl font-black"
                                                showLabels={true}
                                            />
                                            <div className="flex items-center gap-2 mt-3">
                                                <span className="text-xs text-slate-500 font-medium">/ {isEn ? 'person' : 'pessoa'}</span>
                                                <span className="h-3 w-px bg-slate-200" />
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    {isEn
                                                        ? `up to ${publicMaxInstallments} instalments`
                                                        : `até ${publicMaxInstallments} prestações`}
                                                </span>
                                            </div>
                                            {currency !== 'EUR' && (
                                                <p className="text-[9px] text-amber-600/80 mt-2 font-medium">
                                                    {isEn ? `* ${currency} is indicative · contract price in EUR` : `* ${currency} indicativo · preço contratual em EUR`}
                                                </p>
                                            )}
                                        </div>

                                        <div className="px-5 py-4 space-y-3">
                                        {(hasIncludedInfo || hasFlightInfo) && (
                                            <div className="mb-5 grid gap-2.5">
                                                {hasIncludedInfo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveInfoModal('included')}
                                                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-yellow-300 hover:bg-yellow-50"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900">{isEn ? "See what's included in the land package" : 'Ver o que está incluído no terrestre'}</p>
                                                            <p className="text-xs text-slate-500">{isEn ? 'What is and is not included in the price above.' : 'Incluído e não incluído no valor acima.'}</p>
                                                        </div>
                                                        <ArrowRight className="h-4 w-4 text-slate-400" />
                                                    </button>
                                                )}
                                                {hasFlightInfo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveInfoModal('flights')}
                                                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-yellow-300 hover:bg-yellow-50"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900">
                                                                {countryBasedFlightPolicy
                                                                    ? (isEn ? 'See mandatory flight rules' : 'Ver regras obrigatórias dos voos')
                                                                    : (isEn ? 'See flight options' : 'Ver opções de voo')}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {countryBasedFlightPolicy
                                                                    ? (isEn
                                                                        ? 'Check the rules by country of residence and what is paid directly to the agency.'
                                                                        : 'Consulte as regras por país de residência e o que é pago diretamente à agência.')
                                                                    : (isEn
                                                                        ? 'Learn what is paid separately and which options are available.'
                                                                        : 'Saiba o que é pago à parte e as opções disponíveis.')}
                                                            </p>
                                                        </div>
                                                        <ArrowRight className="h-4 w-4 text-slate-400" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-3 mb-6">
                                            <div className="flex justify-between py-2.5 border-b text-slate-600 font-medium"><span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {isEn ? 'Departure' : 'Partida'}</span><span className="text-slate-900 font-bold">{format(startDate, shortDateFmt, { locale: dateLocale })}</span></div>
                                            {pilgrimage.registration_deadline && (
                                                <div className="flex justify-between py-2.5 border-b text-slate-600 font-medium">
                                                    <span className="flex items-center gap-2 text-red-500 font-bold"><Clock className="w-4 h-4" /> {isEn ? 'Registrations until' : 'Inscrições até'}</span>
                                                    <span className="text-red-600 font-bold">{format(parseCivilDate(pilgrimage.registration_deadline), shortDateFmt, { locale: dateLocale })}</span>
                                                </div>
                                            )}
                                            {/* Vacancy Logic for UI */}
                                            <div className="flex justify-between py-2.5 border-b text-slate-600 font-medium">
                                                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {isEn ? 'Available Spots' : 'Vagas Disponíveis'}</span>
                                                <span className="text-slate-900 font-bold">
                                                    {isClosed ? (isEn ? 'Closed' : 'Encerradas') : isWaitlist ? (isEn ? 'Waiting List' : 'Lista de Espera') : getAvailabilityHighlightLabel(remainingSpots, locale, pilgrimage)}
                                                </span>
                                            </div>
                                        </div>
                                        {isClosed ? (
                                            <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-4 rounded-xl cursor-not-allowed">{isEn ? 'Closed' : 'Encerradas'}</button>
                                        ) : existingBooking ? (
                                            <Link href={registrationLink} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"><CheckCircle2 className="w-5 h-5" /> {isEn ? 'Manage Registration' : 'Gerir Inscrição'}</Link>
                                        ) : shouldWarnBeforeRegistration ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsPaymentWarningOpen(true)}
                                                className="group w-full bg-slate-950 hover:bg-slate-900 text-white py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] ring-2 ring-yellow-300/70"
                                            >
                                                <span className="text-[15px] font-black uppercase tracking-[0.12em]">{isEn ? 'Start Registration' : 'Começar Inscrição'}</span>
                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-300 text-slate-950 transition-transform group-hover:translate-x-0.5">
                                                    <ArrowRight className="w-4 h-4" />
                                                </span>
                                            </button>
                                        ) : (
                                            <Link href={registrationLink} className="group w-full bg-slate-950 hover:bg-slate-900 text-white py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] ring-2 ring-yellow-300/70">
                                                <span className="text-[15px] font-black uppercase tracking-[0.12em]">{isEn ? 'Start Registration' : 'Começar Inscrição'}</span>
                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-300 text-slate-950 transition-transform group-hover:translate-x-0.5">
                                                    <ArrowRight className="w-4 h-4" />
                                                </span>
                                            </Link>
                                        )}
                                        </div>
                                    </div>
                                )}
                                {/* AI Chat Widget replaces WhatsApp */}                            </div>
                        </div>
                    </div>

                    {/* Portaled Components */}
                    <div className="pb-24 lg:pb-0">
                        <UniversalStickyBar
                            price={pilgrimage.base_price}
                            deposit={pilgrimage.deposit_value || pilgrimage.min_deposit || 0}
                            link={isWaitlist ? '#' : registrationLink}
                            isClosed={isClosed || isWaitlist}
                            pilgrimageId={pilgrimage.id}
                            slug={pilgrimage.slug}
                            buttonText={existingBooking ? (isEn ? 'Manage Registration' : 'Gerir Inscrição') : (isWaitlist ? (isEn ? 'Waiting List' : 'Lista de Espera') : (isEn ? 'Start Registration' : 'Iniciar Inscrição'))}
                            depositValue={pilgrimage.deposit_value || 0}
                            showIncludedButton={hasIncludedInfo}
                            showFlightsButton={hasFlightInfo}
                            onOpenIncluded={() => setActiveInfoModal('included')}
                            onOpenFlights={() => setActiveInfoModal('flights')}
                            onPrimaryClick={isAdminPreview
                                ? () => undefined
                                : shouldWarnBeforeRegistration
                                    ? () => setIsPaymentWarningOpen(true)
                                    : undefined}
                            maxInstallments={publicMaxInstallments}
                        />
                    </div>
                </div>
            </div>
            <PilgrimageInfoModal
                mode={activeInfoModal || 'included'}
                isOpen={activeInfoModal !== null}
                onClose={() => setActiveInfoModal(null)}
                registrationLink={registrationLink}
                includedItems={includedItemsToShow}
                notIncludedItems={notIncludedItemsToShow}
                flightInfoText={flightInfoTextToShow}
                flightPriceFrom={pilgrimage.flight_price_from}
                groupFlightDetails={groupFlightDetailsToShow}
                flightRegistrationPolicy={countryBasedFlightPolicy}
                meetingPointText={meetingPointTextToShow}
                meetingEndText={meetingEndTextToShow}
                paymentPlanText={paymentPlanTextToShow}
                cancellationPolicyText={cancellationPolicyTextToShow}
                basePrice={pilgrimage.base_price}
                depositValue={pilgrimage.deposit_value}
                accommodationRating={accommodationRatingToShow}
                accommodationDescription={accommodationDescriptionToShow}
                accommodationImage={globalLogistics?.accommodation_image}
                transportType={transportTypeToShow}
                transportDescription={transportDescriptionToShow}
                transportImage={globalLogistics?.transport_image}
            />
            <PilgrimagePaymentWarningModal
                isOpen={isPaymentWarningOpen}
                onClose={() => setIsPaymentWarningOpen(false)}
                continueLink={registrationLink}
            />
            {/* ExitIntentPopup Removed */}
            <ChatWidget
                pilgrimageSlug={pilgrimage.slug}
                pilgrimageTitle={pilgrimageTitle}
                pilgrimageId={pilgrimage.id}
                remainingSpots={remainingSpots}
                registrationLink={registrationLink}
                isWaitlist={isWaitlist}
            />
        </VIPLayout >
    );
}
