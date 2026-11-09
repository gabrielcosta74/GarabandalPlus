"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useParams, useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import { getScarcitySoldPercent, parseCivilDate } from '../../../lib/utils';
import { richTextToPlain } from '../../../lib/rich-text';
import PilgrimageInfoModal from '../../../components/pilgrimage/PilgrimageInfoModal';
import PilgrimagePaymentWarningModal from '../../../components/pilgrimage/PilgrimagePaymentWarningModal';
import { useLocale } from '../../../contexts/LocaleContext';
import { observeSiteSections, setSitePilgrimageContext, trackSiteEvent } from '../../../lib/site-tracker';
import { capturePostHogEvent } from '../../../lib/analytics';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../../lib/cookie-consent';
import WaitlistModal from '../../../components/pilgrimage/WaitlistModal';
import { useCurrency } from '../../../components/providers/CurrencyProvider';
import ChatWidget from '../../../components/pilgrimage/ChatWidget';
import CinemaHero from '../../../components/pilgrimage/cinema/CinemaHero';
import RouteSection from '../../../components/pilgrimage/cinema/RouteSection';
import CinemaStops from '../../../components/pilgrimage/cinema/CinemaStops';
import TeamSection from '../../../components/pilgrimage/cinema/TeamSection';
import PracticalSection from '../../../components/pilgrimage/cinema/PracticalSection';
import ClosingSection from '../../../components/pilgrimage/cinema/ClosingSection';
import BookingDock from '../../../components/pilgrimage/cinema/BookingDock';
import type { BookingCta, BookingSummary } from '../../../components/pilgrimage/cinema/types';
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
import './pilgrimage-theme.css';
import '../../../components/pilgrimage/cinema/cinema.css';

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

/**
 * Frase de abertura da secção "O caminho": a descrição em texto simples, sem o
 * parágrafo "Percurso: A - B - C", porque o percurso aparece desenhado logo a seguir.
 */
const statementFrom = (description?: string | null) => {
    const parts = String(description || '')
        .split(/<\/p>|<br\s*\/?>|\n+/i)
        .map((part) => richTextToPlain(part))
        .filter(Boolean);
    const kept = parts.filter((part) => !/^(percurso|route|itiner[aá]rio)\s*:/i.test(part));
    return (kept.length ? kept : parts).join(' ');
};

export default function PilgrimageDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { currency, formatEUR, formatConverted } = useCurrency();
    const { locale, t } = useLocale();
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
    const [dockSheetOpen, setDockSheetOpen] = useState(false);
    const [stopReaderOpen, setStopReaderOpen] = useState(false);

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
            <VIPLayout allowPublic={true} className="min-h-screen bg-[#0c0c0c]">
                <div className="pilgrimage-detail pilgrimage-loading" role="status" aria-live="polite">
                    <span className="sr-only">{isEn ? 'Loading pilgrimage…' : 'A carregar peregrinação…'}</span>
                    <div className="pg-hero pg-night">
                        <div className="pg-hero-inner">
                            <div className="pg-skeleton aspect-[1198/1313] w-full max-w-[520px] justify-self-center rounded-[20px] lg:order-2 lg:justify-self-end" />
                            <div className="flex flex-col gap-4 lg:order-1">
                                <span className="pg-skeleton h-3 w-40 rounded-full" />
                                <span className="pg-skeleton h-14 w-[90%] rounded-2xl" />
                                <span className="pg-skeleton h-14 w-[70%] rounded-2xl" />
                                <span className="pg-skeleton mt-4 h-12 w-56 rounded-full" />
                            </div>
                        </div>
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
    const shortDateFmt = isEn ? "MMM d" : "d MMM";
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
    const publicLaunchTs = getPublicLaunchTimestamp(pilgrimage);
    const inEarlyAccess = publicLaunchTs !== null && Date.now() < publicLaunchTs;

    // ---------- Apresentação (sem contas de valores) ----------
    const dayCount = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
    const shortWithYearFmt = isEn ? 'MMM d, yyyy' : 'd MMM yyyy';
    // "11–24 de outubro de 2027" / "October 11–24, 2027" (e meses diferentes quando é o caso).
    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
    const compactDate = isEn
        ? sameMonth
            ? `${format(startDate, 'MMMM d', { locale: dateLocale })}–${format(endDate, 'd, yyyy', { locale: dateLocale })}`
            : `${format(startDate, 'MMMM d', { locale: dateLocale })} – ${format(endDate, 'MMMM d, yyyy', { locale: dateLocale })}`
        : sameMonth
            ? `${format(startDate, 'd', { locale: dateLocale })}–${format(endDate, "d 'de' MMMM 'de' yyyy", { locale: dateLocale })}`
            : `${format(startDate, "d 'de' MMMM", { locale: dateLocale })} – ${format(endDate, "d 'de' MMMM 'de' yyyy", { locale: dateLocale })}`;
    const showScarcity = scarcityPct > 0 && !isClosed && !isWaitlist && remainingSpots > 6;
    const back = {
        href: isAdminPreview && previewId ? `/admin/peregrinacoes/${previewId}` : listPath,
        label: isAdminPreview ? 'Voltar ao editor' : (isEn ? 'All pilgrimages' : 'Todas as peregrinações'),
    };

    // Mesmas regras do botão de sempre: encerrada → desativado; lista de espera →
    // modal; inscrição existente → gerir; aviso de pagamento → modal; senão → link.
    const cta: BookingCta = isClosed
        ? { kind: 'closed', label: isEn ? 'Closed' : 'Encerradas', href: registrationLink }
        : isWaitlist
            ? { kind: 'waitlist', label: isEn ? 'Join the waiting list' : 'Entrar na lista de espera', href: registrationLink, onClick: () => setIsWaitlistOpen(true) }
            : existingBooking
                ? { kind: 'manage', label: isEn ? 'Manage Registration' : 'Gerir Inscrição', href: registrationLink }
                : {
                    kind: 'start',
                    label: isEn ? 'Start registration' : 'Começar inscrição',
                    href: registrationLink,
                    onClick: shouldWarnBeforeRegistration
                        ? () => setIsPaymentWarningOpen(true)
                        : isAdminPreview
                            ? () => undefined
                            : undefined,
                };

    const summary: BookingSummary = {
        startingEUR: sidebarStartingEUR,
        startingConverted: sidebarStartingConverted,
        baseEUR: sidebarBaseEUR,
        depositEUR: sidebarDepositEUR,
        currency,
        maxInstallments: publicMaxInstallments,
        departureLabel: format(startDate, shortDateFmt, { locale: dateLocale }),
        deadlineLabel: pilgrimage.registration_deadline
            ? format(parseCivilDate(pilgrimage.registration_deadline), shortWithYearFmt, { locale: dateLocale })
            : null,
        lastSpots: !isClosed && !isWaitlist && remainingSpots > 0 && remainingSpots <= 6,
        hasIncludedInfo,
        hasFlightInfo,
        flightsLabel: countryBasedFlightPolicy
            ? (isEn ? 'See mandatory flight rules' : 'Ver regras obrigatórias dos voos')
            : (isEn ? 'See flight options' : 'Ver opções de voo'),
        flightsHint: countryBasedFlightPolicy
            ? (isEn
                ? 'Check the rules by country of residence and what is paid directly to the agency.'
                : 'Consulte as regras por país de residência e o que é pago diretamente à agência.')
            : (isEn
                ? 'Learn what is paid separately and which options are available.'
                : 'Saiba o que é pago à parte e as opções disponíveis.'),
        onOpenIncluded: () => setActiveInfoModal('included'),
        onOpenFlights: () => setActiveInfoModal('flights'),
    };

    return (
        <VIPLayout allowPublic={true} className="min-h-screen bg-[#0c0c0c]">
            <div className="pilgrimage-detail">
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

                <CinemaHero
                    title={pilgrimageTitle}
                    coverImage={coverImageToShow}
                    meta={`${compactDate} · ${isEn ? `${dayCount} days` : `${dayCount} dias`}`}
                    scarcityLabel={showScarcity ? (isEn ? `${scarcityPct}% of spots already filled` : `${scarcityPct}% das vagas já preenchidas`) : null}
                    back={back}
                    cta={cta}
                    itineraryLabel={isEn ? 'See the itinerary' : 'Ver o roteiro'}
                />

                <RouteSection
                    statement={statementFrom(pilgrimageDescription)}
                    mission={t.pilgrimages.missionDesc}
                    supportLink={{ href: t.urls.donations, label: isEn ? 'Support the House of the Apostolate' : 'Apoiar a Casa do Apostolado' }}
                    stages={stages}
                    isEn={isEn}
                />

                <CinemaStops items={itineraryItems} totalDays={dayCount} isEn={isEn} skipHref="#pricing" onReaderChange={setStopReaderOpen} />

                <TeamSection members={teamMembers} isEn={isEn} />

                <PracticalSection
                    summary={summary}
                    cta={cta}
                    accommodation={accommodationRatingToShow || undefined}
                    transport={transportTypeToShow || undefined}
                    returnLabel={format(endDate, shortWithYearFmt, { locale: dateLocale })}
                    isEn={isEn}
                />

                <ClosingSection image={coverImageToShow} dateRange={compactDate} cta={cta} back={back} isEn={isEn} />

                <BookingDock cta={cta} summary={summary} isEn={isEn} hideOnMobile={isClosed && !isWaitlist} onSheetChange={setDockSheetOpen} />
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
            <ChatWidget
                pilgrimageSlug={pilgrimage.slug}
                pilgrimageTitle={pilgrimageTitle}
                pilgrimageId={pilgrimage.id}
                remainingSpots={remainingSpots}
                registrationLink={registrationLink}
                isWaitlist={isWaitlist}
                onOpenFlights={() => setActiveInfoModal('flights')}
                hideLauncher={activeInfoModal !== null || dockSheetOpen || stopReaderOpen}
            />
        </VIPLayout>
    );
}
