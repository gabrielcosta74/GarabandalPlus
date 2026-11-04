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
import { observeSiteSections, setSitePilgrimageContext, trackSiteEvent } from '../../../lib/site-tracker';
import { capturePostHogEvent } from '../../../lib/analytics';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../../lib/cookie-consent';

// Lazy load heavy map component
const SpiritMap = dynamic(() => import('../../../components/pilgrimage/SpiritMap'), {
    ssr: false,
    loading: () => {
        const isEnLoad = typeof window !== 'undefined' && (window.location.pathname === '/en' || window.location.pathname.startsWith('/en/'));
        return (
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 flex items-center justify-center" style={{ height: 500 }}>
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400 text-sm">{isEnLoad ? 'Loading map...' : 'A carregar mapa...'}</p>
                </div>
            </div>
        );
    }
});
import UniversalStickyBar from '../../../components/pilgrimage/UniversalStickyBar';
// import ExitIntentPopup from '../../../components/pilgrimage/ExitIntentPopup'; // Removed
import WaitlistModal from '../../../components/pilgrimage/WaitlistModal';
import { useCurrency } from '../../../components/providers/CurrencyProvider';
import ChatWidget from '../../../components/pilgrimage/ChatWidget';
import RichText from '../../../components/pilgrimage/RichText';
import PilgrimageTeam from '../../../components/pilgrimage/PilgrimageTeam';
import PilgrimageItineraryDays from '../../../components/pilgrimage/PilgrimageItineraryDays';
import PilgrimageScarcityNote from '../../../components/pilgrimage/PilgrimageScarcityNote';
import PilgrimageAccessGate, { type GateInfo } from '../../../components/pilgrimage/PilgrimageAccessGate';
import EarlyAccessBanner from '../../../components/pilgrimage/EarlyAccessBanner';
import EarlyAccessUrgencyModal from '../../../components/pilgrimage/EarlyAccessUrgencyModal';
import { getPublicLaunchTimestamp } from '../../../lib/pilgrimage-early-access';
import {
    CountryBasedFlightPolicy,
    getCountryBasedFlightPolicy,
} from '../../../lib/pilgrimage-flight-policy';
import {
    getConfiguredInstallmentDeadline,
    getMaxInstallments,
} from '../../../lib/pilgrimage-installments';
import './pilgrimage-detail.css';

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
    const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
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

    // Tracking próprio: visualização, secções lidas e modais abertos.
    const trackedPilgrimageId = !loading && !isAdminPreview ? pilgrimage?.id : undefined;
    useEffect(() => {
        if (!trackedPilgrimageId || !pilgrimage) return;
        setSitePilgrimageContext(trackedPilgrimageId);
        trackSiteEvent('pilgrimage_viewed', {
            slug: pilgrimage.slug,
            status: pilgrimage.status ?? null,
            has_booking: Boolean(existingBooking),
        });
        let capturedPostHogView = false;
        const captureView = () => {
            if (capturedPostHogView) return;
            capturedPostHogView = capturePostHogEvent('pilgrimage_viewed', {
                pilgrimage_id: trackedPilgrimageId,
                pilgrimage_slug: pilgrimage.slug,
                status: pilgrimage.status ?? null,
            });
        };
        captureView();
        window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, captureView);
        // Espera pelo layout final (mapa e roteiro carregam depois).
        const timer = window.setTimeout(() => {
            observeSiteSections({
                overview: document.getElementById('overview'),
                team: document.getElementById('team'),
                itinerary: document.getElementById('itinerary'),
                pricing: document.getElementById('pricing'),
                trip_details: document.getElementById('trip-details'),
            });
        }, 300);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, captureView);
            setSitePilgrimageContext(undefined);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackedPilgrimageId]);

    useEffect(() => {
        if (trackedPilgrimageId && activeInfoModal) trackSiteEvent('pilgrimage_info_opened', { mode: activeInfoModal });
    }, [trackedPilgrimageId, activeInfoModal]);

    useEffect(() => {
        if (trackedPilgrimageId && isPaymentWarningOpen) trackSiteEvent('pilgrimage_payment_warning_shown');
    }, [trackedPilgrimageId, isPaymentWarningOpen]);

    useEffect(() => {
        if (trackedPilgrimageId && isWaitlistOpen) trackSiteEvent('pilgrimage_waitlist_opened');
    }, [trackedPilgrimageId, isWaitlistOpen]);

    if (loading) {
        return (
            <VIPLayout allowPublic={true}>
                {/* Skeleton with the same hero box as the loaded page, so the content
                    swaps in without a layout shift. */}
                <div className="pilgrimage-detail pilgrimage-loading -mx-4 bg-slate-50 min-h-screen relative md:mx-0" role="status" aria-live="polite">
                    <span className="sr-only">{isEn ? 'Loading pilgrimage…' : 'A carregar peregrinação…'}</span>
                    <div className="pilgrimage-hero pilgrimage-skeleton-hero relative min-h-[460px] w-full overflow-hidden md:h-[68vh] md:min-h-[620px]">
                        <div className="absolute inset-0 container mx-auto px-4 md:px-6 flex flex-col justify-end gap-3 pb-10 md:pb-12">
                            <span className="pilgrimage-skeleton-line h-9 w-32 rounded-full" />
                            <span className="pilgrimage-skeleton-line h-7 w-48 rounded-full" />
                            <span className="pilgrimage-skeleton-line h-10 w-[85%] max-w-2xl rounded-2xl" />
                            <span className="pilgrimage-skeleton-line h-10 w-[60%] max-w-xl rounded-2xl" />
                        </div>
                    </div>
                    <div className="container mx-auto px-4 md:px-6 -mt-8 md:-mt-10 relative z-30">
                        <div className="pilgrimage-skeleton-card h-[60px] rounded-2xl" />
                        <div className="pilgrimage-skeleton-card mt-4 h-64 rounded-3xl lg:w-2/3" />
                    </div>
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
                    <Link href={listPath} className="text-brand hover:underline">{isEn ? 'back to list' : 'voltar à lista'}</Link>
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
    const isWaitlist = !isClosed && (pilgrimage.status === 'waitlist' || remainingSpots <= 0);
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
    const sidebarStartingEUR = formatEUR((pilgrimage.base_price || 0) + (pilgrimage.deposit_value || 0));
    const sidebarStartingConverted = formatConverted((pilgrimage.base_price || 0) + (pilgrimage.deposit_value || 0));
    const isNovemberCampaign = isNovemberCampaignPilgrimage(pilgrimage);
    const publicLaunchTs = getPublicLaunchTimestamp(pilgrimage);
    const inEarlyAccess = publicLaunchTs !== null && Date.now() < publicLaunchTs;

    return (
        <VIPLayout allowPublic={true}>
            <div className="pilgrimage-detail -mx-4 bg-slate-50 min-h-screen relative md:mx-0">
                {inEarlyAccess && publicLaunchTs !== null && (
                    <EarlyAccessBanner
                        target={publicLaunchTs}
                        isEn={isEn}
                        onExpire={() => setReloadKey((k) => k + 1)}
                    />
                )}
                {inEarlyAccess && !isAdminPreview && (
                    <EarlyAccessUrgencyModal slug={pilgrimage.slug} isEn={isEn} />
                )}
                {isAdminPreview && (
                    <div className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider text-amber-950 shadow-sm">
                        <Eye className="h-4 w-4" />
                        Pré-visualização privada · rascunho não publicado
                    </div>
                )}
                {/* Hero Header */}
                <div className="pilgrimage-hero relative min-h-[460px] w-full overflow-hidden md:h-[68vh] md:min-h-[620px]">
                    <div className="absolute inset-0 bg-slate-950/35 z-10" />
                    {coverImageToShow && (
                        <img
                            src={coverImageToShow}
                            alt={pilgrimageTitle}
                            className="pilgrimage-hero-img absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/75 via-slate-950/25 to-transparent" />
                    <div className="pilgrimage-hero-content absolute inset-0 z-20 container mx-auto px-4 md:px-6 h-full flex flex-col justify-end pb-10 md:pb-12">
                        <Link
                            href={isAdminPreview && previewId ? `/admin/peregrinacoes/${previewId}` : listPath}
                            className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                        >
                            <ArrowLeft className="w-4 h-4" /> {isAdminPreview ? 'Voltar ao editor' : (isEn ? 'Back to list' : 'Voltar à lista')}
                        </Link>
                        <div className="mb-2.5 flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-[#4b7bf0] to-brand-700 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-brand/30 ring-1 ring-white/20">
                            <Plane className="w-4 h-4" />
                            <Star className="w-3.5 h-3.5 fill-white" />
                            {isEn ? 'Official Pilgrimage' : 'Peregrinação Oficial'}
                        </div>
                        {scarcityPct > 0 && !isClosed && !isWaitlist && remainingSpots > 6 && (
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
                            <h1 className="text-[clamp(1.8rem,7.6vw,2.25rem)] sm:text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-[1.1] drop-shadow-xl">
                                {pilgrimageTitle}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 text-white font-semibold text-base md:text-lg">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 backdrop-blur-md">
                                    <Calendar className="w-5 h-5 text-brand-200" />
                                    <span>{format(startDate, longDateFmt, { locale: dateLocale })} {dateRangeSep} {format(endDate, longDateWithYearFmt, { locale: dateLocale })}</span>
                                </span>
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black uppercase tracking-wide ${
                                    isNovemberCampaign
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-950/25 ring-2 ring-white/80'
                                        : 'bg-emerald-400/95 text-emerald-950'
                                }`}>
                                    {isNovemberCampaign ? <AlertTriangle className="h-4 w-4" /> : null}
                                    <Users className="h-4 w-4" />
                                    {isClosed ? (isEn ? 'Closed' : 'Encerradas') : isWaitlist ? (isEn ? 'Waiting List' : 'Lista de Espera') : remainingSpots <= 6 ? (isEn ? 'Last spots' : 'Últimos lugares') : (isEn ? 'Registration open' : 'Inscrições abertas')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="container mx-auto px-0 md:px-6 -mt-8 md:-mt-10 relative z-30">
                    <nav className="pilgrimage-jump-nav" aria-label={isEn ? 'On this page' : 'Nesta página'}>
                        <a href="#overview" data-track="pilgrimage_nav_clicked" data-track-target="overview">{isEn ? 'Overview' : 'Resumo'}</a>
                        <a href="#team" data-track="pilgrimage_nav_clicked" data-track-target="team">{isEn ? 'Team' : 'Equipa'}</a>
                        <a href="#itinerary" data-track="pilgrimage_nav_clicked" data-track-target="itinerary">{isEn ? 'Itinerary' : 'Roteiro'}</a>
                        <a className="pilgrimage-mobile-nav-link" href="#trip-details" data-track="pilgrimage_nav_clicked" data-track-target="pricing">{isEn ? 'Price & details' : 'Preço e detalhes'}</a>
                        <a className="pilgrimage-desktop-nav-link" href="#pricing" data-track="pilgrimage_nav_clicked" data-track-target="pricing">{isEn ? 'Price & booking' : 'Preço e inscrição'}</a>
                    </nav>
                    <div className="pilgrimage-main-grid grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
                        {/* Column Left */}
                        <div className="lg:col-span-2 space-y-10 md:space-y-12">
                            <div id="overview" className="bg-white rounded-none p-5 shadow-xl border-y border-slate-100 md:rounded-3xl md:border md:p-8">
                                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand">
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
                                            ? 'A journey through Garabandal and other Marian shrines, with time for prayer, community and spiritual guidance throughout the pilgrimage.'
                                            : 'Um caminho por Garabandal e outros santuários marianos, com tempo para oração, vida em comunidade e acompanhamento espiritual ao longo da peregrinação.'}
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

                            <section id="trip-details" className="pilgrimage-essentials lg:hidden" aria-labelledby="pilgrimage-essentials-heading">
                                <p className="pilgrimage-essentials-kicker">{isEn ? 'Before booking' : 'Antes da inscrição'}</p>
                                <h2 id="pilgrimage-essentials-heading">{isEn ? 'Price and trip details' : 'Preço e detalhes da viagem'}</h2>
                                <div className="pilgrimage-essentials-price">
                                    <span>{isEn ? 'From / person · flight not included' : 'Desde / pessoa · voo não incluído'}</span>
                                    <strong>{sidebarStartingEUR}</strong>
                                    <small>{sidebarBaseEUR} {isEn ? 'land package' : 'terrestre'} + {sidebarDepositEUR} {isEn ? 'registration' : 'inscrição'}</small>
                                    {sidebarStartingConverted && <small>≈ {sidebarStartingConverted} · {isEn ? 'indicative exchange rate' : 'câmbio indicativo'}</small>}
                                    <small>{isEn ? `Up to ${publicMaxInstallments} instalments` : `Até ${publicMaxInstallments} prestações`}</small>
                                </div>
                                {pilgrimage.registration_deadline && <p className="pilgrimage-essentials-deadline"><Clock className="h-4 w-4" aria-hidden="true" />{isEn ? 'Registration until' : 'Inscrições até'} {format(parseCivilDate(pilgrimage.registration_deadline), longDateWithYearFmt, { locale: dateLocale })}</p>}
                            </section>

                            {/* Equipa da Peregrinação */}
                            <div id="team"><PilgrimageTeam members={teamMembers} isEn={isEn} /></div>

                            {/* Itinerary */}
                            <section id="itinerary" className="rounded-none bg-white p-5 shadow-xl border-y border-slate-100 md:rounded-[2rem] md:border md:p-8" aria-labelledby="itinerary-heading">
                                <div className="mb-6">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand">
                                        <Clock className="w-4 h-4" />
                                        {isEn ? 'Day by day' : 'Dia a dia'}
                                    </div>
                                    <h2 id="itinerary-heading" className="text-2xl md:text-3xl font-serif font-bold text-slate-900">{isEn ? 'Spiritual Itinerary' : 'Roteiro Espiritual'}</h2>
                                    <p className="mt-2 max-w-2xl text-sm md:text-base leading-relaxed text-slate-600">
                                        {isEn ? 'Explore each day of the journey. Select a day below to go straight to its programme.' : 'Descubra cada dia da viagem. Escolha um dia abaixo para ir diretamente ao seu programa.'}
                                    </p>
                                    {itineraryItems.length > 0 && <span className="itinerary-day-count">{itineraryItems.length} {isEn ? (itineraryItems.length === 1 ? 'day in the programme' : 'days in the programme') : (itineraryItems.length === 1 ? 'dia de programa' : 'dias de programa')}</span>}
                                </div>
                                {stages.length > 0 && <div className="itinerary-map mb-8 overflow-hidden rounded-2xl"><SpiritMap stages={stages} height={420} /></div>}
                                <PilgrimageItineraryDays items={itineraryItems} isEn={isEn} />
                            </section>


                        </div>

                        {/* Column Right (Sidebar) */}
                        <div className={`${isClosed && !isWaitlist ? '' : 'hidden lg:block'} md:px-0 lg:col-span-1`}>
                            <div className="sticky top-24 space-y-6">
                                {/* Waitlist OR Booking Card */}
                                <div id="pricing" className="bg-white rounded-none shadow-2xl border-y border-brand-200/60 relative overflow-hidden md:rounded-3xl md:border">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4b7bf0] via-brand to-brand-700" />

                                        {/* Price block */}
                                        <div className="px-5 pt-6 pb-4 border-b border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                                {isEn ? 'From / person · flight not included' : 'Desde / pessoa · voo não incluído'}
                                            </p>
                                            {/* Lowest land-package price, including registration, before room supplements. */}
                                            <div className="flex items-baseline gap-x-2.5 gap-y-0.5 flex-wrap">
                                                <span className="text-4xl font-black text-slate-900 leading-none">{sidebarStartingEUR}</span>
                                                {sidebarStartingConverted && (
                                                    <span className="text-sm font-bold text-slate-400 leading-none">≈ {sidebarStartingConverted}</span>
                                                )}
                                            </div>
                                            <div className="mt-1.5 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                                                <span className="text-sm font-semibold text-slate-600">{sidebarBaseEUR} {isEn ? 'land package' : 'terrestre'} + {sidebarDepositEUR} {isEn ? 'registration' : 'inscrição'}</span>
                                            </div>
                                            <p className="mt-2.5 text-[10px] uppercase tracking-widest font-bold text-emerald-600">
                                                {isEn ? 'Contract price in EUR' : 'Preço contratual em EUR'}
                                                {sidebarStartingConverted && (
                                                    <span className="text-brand"> · {currency} {isEn ? "today's rate" : 'câmbio do dia'}</span>
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
                                                <p className="text-[9px] text-slate-500 mt-2 font-medium">
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
                                                        className="pilgrimage-sidebar-info flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
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
                                                        className="pilgrimage-sidebar-info flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
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
                                        ) : isWaitlist ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsWaitlistOpen(true)}
                                                data-track="pilgrimage_waitlist_clicked"
                                                data-track-placement="pricing"
                                                className="pilgrimage-main-cta btn-member group min-h-12 w-full gap-3 rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] !text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                                            >
                                                <span>{isEn ? 'Join the waiting list' : 'Entrar na lista de espera'}</span>
                                                <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                                            </button>
                                        ) : existingBooking ? (
                                            <Link href={registrationLink} className="pilgrimage-manage-cta flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-bold !text-white shadow-lg"><CheckCircle2 className="w-5 h-5" /> {isEn ? 'Manage Registration' : 'Gerir Inscrição'}</Link>
                                        ) : shouldWarnBeforeRegistration ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsPaymentWarningOpen(true)}
                                                data-track="pilgrimage_cta_clicked"
                                                data-track-placement="pricing"
                                                className="pilgrimage-main-cta btn-member group min-h-12 w-full gap-3 rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] !text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                                            >
                                                <span>{isEn ? 'Start registration' : 'Começar inscrição'}</span>
                                                <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                                            </button>
                                        ) : (
                                            <Link href={registrationLink} data-track="pilgrimage_cta_clicked" data-track-placement="pricing" className="pilgrimage-main-cta btn-member group min-h-12 w-full gap-3 rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] !text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
                                                <span>{isEn ? 'Start registration' : 'Começar inscrição'}</span>
                                                <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                                            </Link>
                                        )}
                                        </div>
                                </div>
                                {/* AI Chat Widget replaces WhatsApp */}                            </div>
                        </div>
                    </div>

                    {/* Portaled Components */}
                    <div>
                        <UniversalStickyBar
                            price={pilgrimage.base_price}
                            deposit={pilgrimage.deposit_value || pilgrimage.min_deposit || 0}
                            link={isWaitlist ? '#' : registrationLink}
                            isClosed={isClosed}
                            isWaitlist={isWaitlist}
                            pilgrimageId={pilgrimage.id}
                            slug={pilgrimage.slug}
                            buttonText={existingBooking ? (isEn ? 'Manage Registration' : 'Gerir Inscrição') : (isWaitlist ? (isEn ? 'Join the waiting list' : 'Entrar na lista de espera') : (isEn ? 'Start registration' : 'Começar inscrição'))}
                            depositValue={pilgrimage.deposit_value || 0}
                            showIncludedButton={hasIncludedInfo}
                            showFlightsButton={hasFlightInfo}
                            onOpenIncluded={() => setActiveInfoModal('included')}
                            onOpenFlights={() => setActiveInfoModal('flights')}
                            onPrimaryClick={isAdminPreview
                                ? () => undefined
                                : isWaitlist
                                    ? () => setIsWaitlistOpen(true)
                                    : shouldWarnBeforeRegistration
                                        ? () => setIsPaymentWarningOpen(true)
                                        : undefined}
                            maxInstallments={publicMaxInstallments}
                        />
                    </div>
                </div>
            </div>
            <WaitlistModal
                isOpen={isWaitlistOpen}
                onClose={() => setIsWaitlistOpen(false)}
                pilgrimageId={pilgrimage.id}
                pilgrimageTitle={pilgrimageTitle}
            />
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
                onOpenFlights={() => setActiveInfoModal('flights')}
                hideLauncher={activeInfoModal !== null}
            />
        </VIPLayout >
    );
}
