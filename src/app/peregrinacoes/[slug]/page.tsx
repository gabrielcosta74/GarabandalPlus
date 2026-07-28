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
    Eye,
    Flame
} from 'lucide-react';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { getScarcitySoldPercent, isNovemberCampaignPilgrimage, parseCivilDate } from '../../../lib/utils';
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
import ChatWidget from '../../../components/pilgrimage/ChatWidget';
import RichText from '../../../components/pilgrimage/RichText';
import PilgrimageTeam from '../../../components/pilgrimage/PilgrimageTeam';
import PilgrimageItineraryDays from '../../../components/pilgrimage/PilgrimageItineraryDays';
import PilgrimageScarcityNote from '../../../components/pilgrimage/PilgrimageScarcityNote';
import PilgrimageAccessGate, { type GateInfo } from '../../../components/pilgrimage/PilgrimageAccessGate';
import EarlyAccessBanner from '../../../components/pilgrimage/EarlyAccessBanner';
import { getPublicLaunchTimestamp } from '../../../lib/pilgrimage-early-access';
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
    cover_image_en?: string | null;
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
        /** Optional per-pilgrimage override for the vacancy-ring fill %. */
        scarcity_fill_pct?: number;
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
    images?: string[] | null;
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
    const { currency, formatEUR, formatConverted } = useCurrency();
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
    const [gateInfo, setGateInfo] = useState<GateInfo | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

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
                // The public RPC + RLS hide early-access pilgrimages until launch,
                // so a null here may be a private pre-launch trip. Ask the gate.
                const gateRes = await fetch(`/api/pilgrimages/${encodeURIComponent(slug)}/gate-info`, { cache: 'no-store' })
                    .then((r) => (r.ok ? r.json() : null))
                    .catch(() => null);

                if (gateRes?.preLaunch) {
                    setGateInfo(gateRes as GateInfo);
                    // If we already hold a valid grant cookie, load the real content.
                    const ea = await fetch(`/api/pilgrimages/${encodeURIComponent(slug)}/early-access`, { cache: 'no-store' })
                        .then((r) => (r.ok ? r.json() : null))
                        .catch(() => null);

                    if (ea?.pilgrimage) {
                        setPilgrimage(ea.pilgrimage as Pilgrimage);
                        setGlobalLogistics((ea.globalLogistics ?? null) as GlobalLogistics | null);
                        setStages((ea.stages || []) as Stage[]);
                        setItineraryItems((ea.itineraryItems || []) as ItineraryItem[]);
                        setTeamMembers((ea.teamMembers || []) as TeamMember[]);
                        const { data: { user } } = await supabaseBrowser.auth.getUser();
                        if (user) {
                            const { data: bData } = await supabaseBrowser
                                .from('bookings')
                                .select('id')
                                .eq('pilgrimage_id', ea.pilgrimage.id)
                                .eq('user_id', user.id)
                                .maybeSingle();
                            if (bData) setExistingBooking(bData.id);
                        }
                    }
                    setLoading(false);
                    return;
                }
            }

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
        // Never let a rejected/aborted request (e.g. HMR or navigation aborting an
        // in-flight fetch) leave the page stuck on the loading spinner.
        fetchAllData().catch((err) => {
            if (err?.name !== 'AbortError') {
                console.error('[Pilgrimage load] failed:', err);
            }
            setLoading(false);
        });
    }, [previewId, slug, reloadKey]);

    if (loading) {
        return (
            <VIPLayout allowPublic={true}>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-yellow-600 border-t-transparent rounded-full" />
                </div>
            </VIPLayout>
        );
    }

    // Private early-access gate: shown when the pilgrimage is pre-launch and the
    // visitor has not unlocked it yet. Full-screen cinematic takeover.
    // `?gate=1` forces the gate even after unlocking (design review convenience).
    const forceGate = searchParams.get('gate') === '1';
    if (gateInfo && (forceGate || !pilgrimage)) {
        return (
            <PilgrimageAccessGate
                slug={slug}
                gateInfo={gateInfo}
                isEn={isEn}
                onUnlocked={() => setReloadKey((k) => k + 1)}
            />
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
    const scarcityPct = getScarcitySoldPercent(pilgrimage);
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
    const coverImageToShow = isEn ? (pilgrimage.cover_image_en || pilgrimage.cover_image) : pilgrimage.cover_image;

    // Sidebar price — presentation only, mirrors the mobile sticky bar
    // (base value + registration shown separately, each with its own currency
    // conversion). No amount maths changed.
    const sidebarBaseEUR = formatEUR(pilgrimage.base_price || 0);
    const sidebarDepositEUR = formatEUR(pilgrimage.deposit_value || 0);
    const sidebarBaseConverted = formatConverted(pilgrimage.base_price || 0);
    const sidebarDepositConverted = formatConverted(pilgrimage.deposit_value || 0);
    const isNovemberCampaign = isNovemberCampaignPilgrimage(pilgrimage);
    const publicLaunchTs = getPublicLaunchTimestamp(pilgrimage);
    const inEarlyAccess = publicLaunchTs !== null && Date.now() < publicLaunchTs;

    return (
        <VIPLayout allowPublic={true}>
            <div className="-mx-4 bg-slate-50 min-h-screen relative pb-20 md:mx-0">
                {inEarlyAccess && publicLaunchTs !== null && (
                    <EarlyAccessBanner
                        target={publicLaunchTs}
                        isEn={isEn}
                        onExpire={() => setReloadKey((k) => k + 1)}
                    />
                )}
                {isAdminPreview && (
                    <div className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider text-amber-950 shadow-sm">
                        <Eye className="h-4 w-4" />
                        Pré-visualização privada · rascunho não publicado
                    </div>
                )}
                {/* Hero Header */}
                <div className="relative min-h-[560px] w-full overflow-hidden md:h-[68vh] md:min-h-[620px]">
                    <div className="absolute inset-0 bg-slate-950/35 z-10" />
                    {coverImageToShow && (
                        <img
                            src={coverImageToShow}
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
                        <div className="mb-2.5 flex w-fit items-center gap-2 rounded-full bg-yellow-300 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-950 shadow-lg">
                            <Plane className="w-4 h-4" />
                            <Star className="w-3.5 h-3.5 fill-slate-950" />
                            {isEn ? 'Official Pilgrimage' : 'Peregrinação Oficial'}
                        </div>
                        {!isClosed && !isWaitlist && remainingSpots > 6 && (
                            <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-red-400/40 bg-red-600/95 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/30 backdrop-blur-sm">
                                <span className="relative flex h-2 w-2" aria-hidden>
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-200" />
                                </span>
                                <Flame className="h-3.5 w-3.5" strokeWidth={2.5} />
                                {isEn ? `${scarcityPct}% of spots already filled` : `${scarcityPct}% das vagas já preenchidas`}
                            </div>
                        )}
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
                                    {isClosed ? (isEn ? 'Closed' : 'Encerradas') : isWaitlist ? (isEn ? 'Waiting List' : 'Lista de Espera') : (isEn ? 'Limited spots, filling fast' : 'Vagas limitadas, esgotam rápido')}
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
                                <RichText value={pilgrimageDescription} className="text-slate-700 text-base md:text-lg leading-8" />
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
                            <PilgrimageTeam members={teamMembers} isEn={isEn} />

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
                                <PilgrimageItineraryDays items={itineraryItems} isEn={isEn} />
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
                                            {/* Base value + its conversion */}
                                            <div className="flex items-baseline gap-x-2.5 gap-y-0.5 flex-wrap">
                                                <span className="text-4xl font-black text-slate-900 leading-none">{sidebarBaseEUR}</span>
                                                {sidebarBaseConverted && (
                                                    <span className="text-sm font-bold text-slate-400 leading-none">≈ {sidebarBaseConverted}</span>
                                                )}
                                            </div>
                                            {/* Registration fee + its conversion */}
                                            <div className="mt-1.5 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                                                <span className="text-lg font-black text-slate-600 leading-none">+ {sidebarDepositEUR}</span>
                                                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{isEn ? 'registration' : 'inscrição'}</span>
                                                {sidebarDepositConverted && (
                                                    <span className="text-xs font-bold text-slate-400 leading-none">≈ {sidebarDepositConverted}</span>
                                                )}
                                            </div>
                                            <p className="mt-2.5 text-[10px] uppercase tracking-widest font-bold text-emerald-600">
                                                {isEn ? 'Fixed price in EUR' : 'Preço fixo em EUR'}
                                                {sidebarBaseConverted && (
                                                    <span className="text-amber-500"> · {currency} {isEn ? "today's rate" : 'câmbio do dia'}</span>
                                                )}
                                            </p>
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
                                        </div>
                                        <PilgrimageScarcityNote
                                            remainingSpots={remainingSpots}
                                            isEn={isEn}
                                            isWaitlist={isWaitlist}
                                            isClosed={isClosed}
                                            className="mb-4"
                                        />
                                        {isClosed ? (
                                            <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-4 rounded-xl cursor-not-allowed">{isEn ? 'Closed' : 'Encerradas'}</button>
                                        ) : existingBooking ? (
                                            <Link href={registrationLink} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-bold !text-white shadow-lg"><CheckCircle2 className="w-5 h-5" /> {isEn ? 'Manage Registration' : 'Gerir Inscrição'}</Link>
                                        ) : shouldWarnBeforeRegistration ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsPaymentWarningOpen(true)}
                                                className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 px-5 py-4 text-slate-950 shadow-xl shadow-amber-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-300 hover:via-yellow-200 hover:to-amber-200 hover:shadow-2xl active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
                                            >
                                                <span className="text-base font-extrabold tracking-tight text-slate-950">{isEn ? 'Start registration' : 'Começar inscrição'}</span>
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition-transform group-hover:translate-x-1">
                                                    <ArrowRight className="h-4 w-4" />
                                                </span>
                                            </button>
                                        ) : (
                                            <Link href={registrationLink} className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 px-5 py-4 !text-slate-950 shadow-xl shadow-amber-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-300 hover:via-yellow-200 hover:to-amber-200 hover:!text-slate-950 hover:shadow-2xl active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50">
                                                <span className="text-base font-extrabold tracking-tight !text-slate-950">{isEn ? 'Start registration' : 'Começar inscrição'}</span>
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 !text-white shadow-sm transition-transform group-hover:translate-x-1">
                                                    <ArrowRight className="h-4 w-4" />
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
