"use client";

import { useState } from 'react';
import { differenceInCalendarDays, format, type Locale } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import {
    BedDouble,
    Check,
    ChevronRight,
    Info,
    Luggage,
    Mail,
    MapPin,
    MessageCircle,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    UserRound,
    X,
} from 'lucide-react';
import RichText from '../pilgrimage/RichText';
import { buildWhatsAppLink } from '../../lib/chat-config';

export type TripPilgrim = {
    id?: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    room_type?: string | null;
    flight_option?: string | null;
    allergies?: string | null;
    dietary_restrictions?: string | null;
    country?: string | null;
};

export type TripItineraryItem = {
    id: string;
    title?: string | null;
    title_en?: string | null;
    description?: string | null;
    description_en?: string | null;
    day_number?: number | null;
};

export type TripPilgrimage = {
    title?: string | null;
    slug?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    meeting_point_text?: string | null;
    meeting_point_text_en?: string | null;
    meeting_end_text?: string | null;
    meeting_end_text_en?: string | null;
    flight_departure_time?: string | null;
    flight_return_time?: string | null;
    flight_info_text?: string | null;
    flight_info_text_en?: string | null;
    group_flight_details?: string | null;
    group_flight_details_en?: string | null;
    flight_price_from?: number | null;
    itinerary_summary?: string | null;
    itinerary_summary_en?: string | null;
    included_items?: string[] | null;
    included_items_en?: string[] | null;
    not_included_items?: string[] | null;
    not_included_items_en?: string[] | null;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const CARD = 'rounded-3xl bg-[#0d1117] ring-1 ring-white/10';
const LABEL = 'text-xs font-bold uppercase tracking-[0.16em] text-white/35';

const hasText = (value: unknown): value is string =>
    typeof value === 'string' && value.replace(/<[^>]*>/g, '').trim().length > 0;

/** Picks the English variant when available, falling back to Portuguese. */
const localized = (ptValue: unknown, enValue: unknown, isEn: boolean): string | null => {
    const preferred = isEn && hasText(enValue) ? enValue : ptValue;
    return hasText(preferred) ? preferred : null;
};

/** Admin stores lists loosely — one entry may hold several comma/newline items. */
const normalizeList = (items: unknown): string[] => {
    if (!Array.isArray(items)) return [];
    const flattened = items
        .flatMap((item) => String(item ?? '').split(/[\n;•]+/u))
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set(flattened));
};

const parseDate = (value: unknown): Date | null => {
    if (typeof value !== 'string' || !value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const roomLabel = (type: string | null | undefined, isEn: boolean): string | null => {
    if (!type) return null;
    const labels: Record<string, [string, string]> = {
        single: ['Quarto individual', 'Single room'],
        double: ['Quarto duplo', 'Double room'],
        triple: ['Quarto triplo', 'Triple room'],
        quadruple: ['Quarto quádruplo', 'Quadruple room'],
        family: ['Quarto familiar', 'Family room'],
    };
    const match = labels[String(type).toLowerCase()];
    return match ? match[isEn ? 1 : 0] : String(type);
};

const flightLabel = (option: string | null | undefined, isEn: boolean): string => {
    switch (String(option || '').toLowerCase()) {
        case 'agency':
            return isEn ? 'Flight with the organization' : 'Voo com a organização';
        case 'own':
            return isEn ? 'Flight arranged by you' : 'Voo por tua conta';
        default:
            return isEn ? 'No flight included' : 'Sem voo incluído';
    }
};

const mapsLink = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * Meeting points are free text written by the admin ("Aeroporto de Lisboa ás 09:00").
 * Splitting the hour out keeps the map query geocodable and lets the time stand on
 * its own — it is the part people actually need to remember.
 */
const splitPlaceAndTime = (text: string): { place: string; time: string | null } => {
    // Optionally swallows the connector ("às", "-", ",") so "Lisboa ás 09:00"
    // and "São Paulo - 10h30" both leave a clean place behind.
    const timeExpression = /(?:[\s,–-]+(?:às|ás|as|at|@|pelas))?[\s,–-]*(\d{1,2})\s*[:hH]\s*([0-5]\d)(?!\d)/;
    const match = text.match(timeExpression);
    const hours = match ? Number(match[1]) : NaN;

    if (!match || hours > 23) return { place: text.trim(), time: null };

    const place = text
        .replace(timeExpression, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s,–-]+|[\s,–-]+$/g, '')
        .trim();

    return {
        place: place || text.trim(),
        time: `${String(hours).padStart(2, '0')}:${match[2]}`,
    };
};

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

export default function TripInfoPanel({
    isEn,
    pilgrimage,
    pilgrims,
    itinerary,
}: {
    isEn: boolean;
    pilgrimage: TripPilgrimage;
    pilgrims: TripPilgrim[];
    itinerary: TripItineraryItem[];
}) {
    const [activePilgrimIndex, setActivePilgrimIndex] = useState(0);
    const dateLocale = isEn ? enUS : pt;

    const startDate = parseDate(pilgrimage.start_date);
    const endDate = parseDate(pilgrimage.end_date);
    const meetingPoint = localized(pilgrimage.meeting_point_text, pilgrimage.meeting_point_text_en, isEn);
    const meetingEnd = localized(pilgrimage.meeting_end_text, pilgrimage.meeting_end_text_en, isEn);
    const flightInfo = localized(pilgrimage.flight_info_text, pilgrimage.flight_info_text_en, isEn);
    const groupFlight = localized(pilgrimage.group_flight_details, pilgrimage.group_flight_details_en, isEn);
    const itinerarySummary = localized(pilgrimage.itinerary_summary, pilgrimage.itinerary_summary_en, isEn);
    const included = normalizeList(isEn && pilgrimage.included_items_en?.length ? pilgrimage.included_items_en : pilgrimage.included_items);
    const notIncluded = normalizeList(isEn && pilgrimage.not_included_items_en?.length ? pilgrimage.not_included_items_en : pilgrimage.not_included_items);

    const activePilgrim = pilgrims[activePilgrimIndex] || pilgrims[0] || null;

    const hasFlightBlock = Boolean(
        activePilgrim || flightInfo || groupFlight || pilgrimage.flight_departure_time,
    );
    const hasAnything = Boolean(
        startDate || meetingPoint || meetingEnd || hasFlightBlock
        || itinerary.length > 0 || included.length > 0 || notIncluded.length > 0
        || pilgrims.length > 0,
    );

    if (!hasAnything) {
        return (
            <div className={`${CARD} p-6 text-center md:p-8`}>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-white/35">
                    <Info className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-white">
                    {isEn ? 'Logistics coming soon' : 'Logística a caminho'}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/45">
                    {isEn
                        ? 'We are still closing the trip details. You will get an email as soon as they are ready.'
                        : 'Ainda estamos a fechar os detalhes da viagem. Recebes um email assim que estiverem prontos.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ---------- DATES ---------- */}
            {startDate && (
                <DatesCard
                    startDate={startDate}
                    endDate={endDate}
                    summary={itinerarySummary}
                    isEn={isEn}
                    dateLocale={dateLocale}
                />
            )}

            {/* ---------- PILGRIM SELECTOR (multi-booking only) ---------- */}
            {pilgrims.length > 1 && (
                <div className="no-scrollbar -mb-1 flex gap-2 overflow-x-auto pb-1">
                    {pilgrims.map((pilgrim, index) => (
                        <button
                            key={pilgrim.id || index}
                            type="button"
                            onClick={() => setActivePilgrimIndex(index)}
                            className={`min-h-9 shrink-0 rounded-full px-4 text-sm transition-colors ${index === activePilgrimIndex
                                ? 'bg-white font-bold text-slate-900'
                                : 'bg-white/[0.07] font-medium text-white/60 hover:bg-white/[0.13] hover:text-white'
                                }`}
                        >
                            {pilgrim.full_name?.split(' ').slice(0, 2).join(' ') || (isEn ? 'Pilgrim' : 'Peregrino')}
                        </button>
                    ))}
                </div>
            )}

            {/* ---------- FLIGHT ---------- */}
            {hasFlightBlock && (
                <FlightCard
                    isEn={isEn}
                    dateLocale={dateLocale}
                    option={activePilgrim?.flight_option}
                    departure={parseDate(pilgrimage.flight_departure_time)}
                    ret={parseDate(pilgrimage.flight_return_time)}
                    groupFlight={groupFlight}
                    flightInfo={flightInfo}
                    priceFrom={pilgrimage.flight_price_from}
                    meetingPoint={meetingPoint}
                />
            )}

            {/* ---------- MEETING POINTS ---------- */}
            {(meetingPoint || meetingEnd) && (
                <MeetingCard meetingPoint={meetingPoint} meetingEnd={meetingEnd} isEn={isEn} />
            )}

            {/* ---------- ITINERARY ---------- */}
            {itinerary.length > 0 && (
                <ItineraryCard itinerary={itinerary} isEn={isEn} />
            )}

            {/* ---------- INCLUDED / NOT INCLUDED ---------- */}
            {(included.length > 0 || notIncluded.length > 0) && (
                <IncludedCard included={included} notIncluded={notIncluded} isEn={isEn} />
            )}

            {/* ---------- YOUR DETAILS ---------- */}
            {activePilgrim && (
                <PilgrimDetailsCard pilgrim={activePilgrim} isEn={isEn} />
            )}

            {/* ---------- HELP ---------- */}
            <HelpCard isEn={isEn} pilgrimageTitle={pilgrimage.title} />
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   Cards                                    */
/* -------------------------------------------------------------------------- */

function DatesCard({
    startDate,
    endDate,
    summary,
    isEn,
    dateLocale,
}: {
    startDate: Date;
    endDate: Date | null;
    summary: string | null;
    isEn: boolean;
    dateLocale: Locale;
}) {
    const daysUntil = differenceInCalendarDays(startDate, new Date());
    const nights = endDate ? Math.max(0, differenceInCalendarDays(endDate, startDate)) : null;

    return (
        <div className={CARD}>
            <div className="px-5 pt-5 md:px-6">
                <p className={LABEL}>{isEn ? 'Your trip' : 'A tua viagem'}</p>
            </div>
            <div className="px-5 pb-5 pt-3 md:px-6">
                <p className="text-3xl font-black tracking-tight text-white md:text-4xl">
                    {format(startDate, 'd MMM', { locale: dateLocale })}
                    {endDate && (
                        <span className="text-white/45">
                            {' – '}
                            {format(endDate, 'd MMM yyyy', { locale: dateLocale })}
                        </span>
                    )}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-sm font-bold text-amber-200">
                        {daysUntil > 0
                            ? (isEn ? `In ${daysUntil} days` : `Faltam ${daysUntil} dias`)
                            : daysUntil === 0
                                ? (isEn ? 'Departure is today' : 'A partida é hoje')
                                : (isEn ? 'Already under way' : 'Já a decorrer')}
                    </span>
                    {nights ? (
                        <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-white/50">
                            {nights} {isEn ? 'days' : 'dias'}
                        </span>
                    ) : null}
                </div>

                {summary && (
                    <div className="mt-4 flex items-start gap-2.5 border-t border-white/[0.07] pt-4 text-sm text-white/55">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                        <span>{summary}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function FlightCard({
    isEn,
    dateLocale,
    option,
    departure,
    ret,
    groupFlight,
    flightInfo,
    priceFrom,
    meetingPoint,
}: {
    isEn: boolean;
    dateLocale: Locale;
    option: string | null | undefined;
    departure: Date | null;
    ret: Date | null;
    groupFlight: string | null;
    flightInfo: string | null;
    priceFrom: number | null | undefined;
    meetingPoint: string | null;
}) {
    const normalized = String(option || '').toLowerCase();
    const isAgency = normalized === 'agency';
    // "none" bookings still get the self-arranged guidance whenever the
    // pilgrimage wrote any — that text is what tells them where to show up.
    const isSelfArranged = !isAgency && (normalized === 'own' || hasText(flightInfo));

    return (
        <div className={CARD}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5 md:px-6">
                <p className={LABEL}>{isEn ? 'Flights' : 'Voos'}</p>
                <span className="-mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                    <Plane className="h-4 w-4" />
                </span>
            </div>

            <div className="px-5 pb-5 pt-2 md:px-6">
                <p className="text-xl font-bold text-white">
                    {isAgency
                        ? flightLabel('agency', isEn)
                        : isSelfArranged
                            ? flightLabel('own', isEn)
                            : flightLabel('none', isEn)}
                </p>

                {isAgency && (departure || ret) && (
                    <div className="mt-4 space-y-2.5">
                        {departure && (
                            <FlightLeg
                                icon={PlaneTakeoff}
                                label={isEn ? 'Outbound' : 'Ida'}
                                date={departure}
                                dateLocale={dateLocale}
                            />
                        )}
                        {ret && (
                            <FlightLeg
                                icon={PlaneLanding}
                                label={isEn ? 'Return' : 'Volta'}
                                date={ret}
                                dateLocale={dateLocale}
                            />
                        )}
                    </div>
                )}

                {isAgency && groupFlight && (
                    <RichText
                        value={groupFlight}
                        className="mt-4 text-sm leading-relaxed text-white/55"
                    />
                )}

                {isAgency && typeof priceFrom === 'number' && priceFrom > 0 && (
                    <p className="mt-3 text-sm text-white/40">
                        {isEn ? 'Estimated flight cost from ' : 'Custo estimado do voo desde '}
                        <span className="font-semibold text-white/70">
                            {new Intl.NumberFormat(isEn ? 'en-GB' : 'pt-PT', {
                                style: 'currency',
                                currency: 'EUR',
                                maximumFractionDigits: 0,
                            }).format(priceFrom)}
                        </span>
                    </p>
                )}

                {!isAgency && flightInfo && (
                    <RichText
                        value={flightInfo}
                        className="mt-3 text-sm leading-relaxed text-white/55"
                    />
                )}

                {!isAgency && meetingPoint && (() => {
                    const { place, time } = splitPlaceAndTime(meetingPoint);
                    return (
                        <div className="mt-4 rounded-2xl bg-amber-400/[0.09] p-4 ring-1 ring-inset ring-amber-400/25">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-300">
                                {isEn ? 'Be here' : 'Tens de estar aqui'}
                            </p>
                            <div className="flex items-center gap-3">
                                <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-white">{place}</p>
                                {time && (
                                    <span className="shrink-0 text-xl font-black tabular-nums text-amber-300">{time}</span>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

function FlightLeg({
    icon: Icon,
    label,
    date,
    dateLocale,
}: {
    icon: typeof PlaneTakeoff;
    label: string;
    date: Date;
    dateLocale: Locale;
}) {
    return (
        <div className="flex items-center gap-3.5 rounded-2xl bg-white/[0.04] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/35">{label}</p>
                <p className="mt-0.5 text-base font-semibold text-white">
                    {format(date, 'd MMM yyyy', { locale: dateLocale })}
                </p>
            </div>
            <p className="shrink-0 text-lg font-black tabular-nums text-white">
                {format(date, 'HH:mm')}
            </p>
        </div>
    );
}

function MeetingCard({
    meetingPoint,
    meetingEnd,
    isEn,
}: {
    meetingPoint: string | null;
    meetingEnd: string | null;
    isEn: boolean;
}) {
    const points = [
        meetingPoint
            ? { label: isEn ? 'Start' : 'Início', ...splitPlaceAndTime(meetingPoint) }
            : null,
        meetingEnd
            ? { label: isEn ? 'End' : 'Fim', ...splitPlaceAndTime(meetingEnd) }
            : null,
    ].filter(Boolean) as { label: string; place: string; time: string | null }[];

    return (
        <div className={CARD}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5 md:px-6">
                <p className={LABEL}>{isEn ? 'Meeting points' : 'Pontos de encontro'}</p>
                <span className="-mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                    <MapPin className="h-4 w-4" />
                </span>
            </div>

            <div className="px-5 pb-5 pt-3 md:px-6">
                {points.map((point, index) => (
                    // Each point carries its own map — one shared map under both rows
                    // read as if Paris were in Lisbon.
                    <div
                        key={point.label}
                        className={index > 0 ? 'mt-5 border-t border-white/[0.06] pt-5' : ''}
                    >
                        <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                                    {point.label}
                                </p>
                                <p className="mt-0.5 text-base font-semibold leading-snug text-white">
                                    {point.place}
                                </p>
                            </div>
                            {point.time && (
                                <span className="shrink-0 rounded-full bg-amber-400/15 px-3 py-1.5 text-sm font-bold tabular-nums text-amber-200">
                                    {point.time}
                                </span>
                            )}
                        </div>
                        <MapEmbed place={point.place} isEn={isEn} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Lazy Google Maps preview — no API key needed, keyed off the free-text place. */
function MapEmbed({ place, isEn }: { place: string; isEn: boolean }) {
    return (
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <iframe
                title={`${isEn ? 'Map' : 'Mapa'}: ${place}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed&hl=${isEn ? 'en' : 'pt-PT'}&z=14`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-36 w-full border-0 md:h-44"
            />
            <a
                href={mapsLink(place)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 bg-amber-400 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
            >
                <MapPin className="h-4 w-4" />
                {isEn ? 'Open in Google Maps' : 'Abrir no Google Maps'}
            </a>
        </div>
    );
}

function ItineraryCard({ itinerary, isEn }: { itinerary: TripItineraryItem[]; isEn: boolean }) {
    const days = new Map<number, TripItineraryItem[]>();
    itinerary.forEach((item) => {
        const day = Number(item.day_number) || 0;
        days.set(day, [...(days.get(day) || []), item]);
    });
    const sortedDays = Array.from(days.entries()).sort((a, b) => a[0] - b[0]);

    return (
        <div className={CARD}>
            <div className="px-5 pt-5 md:px-6">
                <p className={LABEL}>{isEn ? 'Itinerary' : 'Roteiro'}</p>
            </div>
            <ul className="mt-1 divide-y divide-white/[0.06] px-5 md:px-6">
                {sortedDays.map(([day, items]) => {
                    const titles = items
                        .map((item) => (isEn && hasText(item.title_en) ? item.title_en : item.title))
                        .filter(hasText);
                    return (
                        <li key={day}>
                            <details className="group py-1">
                                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-200">
                                        {day || '·'}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-bold uppercase tracking-wider text-white/35">
                                            {isEn ? `Day ${day}` : `Dia ${day}`}
                                        </span>
                                        <span className="mt-0.5 block truncate text-base font-semibold text-white">
                                            {titles[0] || (isEn ? 'Programme' : 'Programa')}
                                        </span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-open:rotate-90" />
                                </summary>
                                <div className="space-y-3 pb-4 pl-[3.125rem] pr-1">
                                    {items.map((item) => {
                                        const title = isEn && hasText(item.title_en) ? item.title_en : item.title;
                                        const description = isEn && hasText(item.description_en)
                                            ? item.description_en
                                            : item.description;
                                        return (
                                            <div key={item.id}>
                                                {hasText(title) && items.length > 1 && (
                                                    <p className="text-sm font-semibold text-white/80">{title}</p>
                                                )}
                                                {hasText(description) && (
                                                    <RichText
                                                        value={description}
                                                        className="mt-1 text-sm leading-relaxed text-white/50"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        </li>
                    );
                })}
            </ul>
            <div className="h-2" />
        </div>
    );
}

function IncludedCard({
    included,
    notIncluded,
    isEn,
}: {
    included: string[];
    notIncluded: string[];
    isEn: boolean;
}) {
    return (
        <div className={CARD}>
            <div className="px-5 pt-5 md:px-6">
                <p className={LABEL}>{isEn ? "What's included" : 'O que está incluído'}</p>
            </div>
            <div className="grid gap-x-8 gap-y-5 px-5 pb-5 pt-4 md:grid-cols-2 md:px-6">
                {included.length > 0 && (
                    <ul className="space-y-2.5">
                        {included.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-white/70">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {notIncluded.length > 0 && (
                    <div>
                        <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-white/35">
                            {isEn ? 'Not included' : 'Não incluído'}
                        </p>
                        <ul className="space-y-2.5">
                            {notIncluded.map((item) => (
                                <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-white/45">
                                    <X className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

function PilgrimDetailsCard({ pilgrim, isEn }: { pilgrim: TripPilgrim; isEn: boolean }) {
    const room = roomLabel(pilgrim.room_type, isEn);
    const notes = [pilgrim.allergies, pilgrim.dietary_restrictions]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean);

    return (
        <div className={CARD}>
            <div className="px-5 pt-5 md:px-6">
                <p className={LABEL}>{isEn ? 'Your details' : 'Os teus dados'}</p>
            </div>
            <div className="px-5 pb-5 pt-3 md:px-6">
                <div className="flex items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                        <UserRound className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-base font-semibold text-white">
                        {pilgrim.full_name || (isEn ? 'Pilgrim' : 'Peregrino')}
                    </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/[0.04] p-4">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/35">
                            <BedDouble className="h-3.5 w-3.5" /> {isEn ? 'Room' : 'Quarto'}
                        </p>
                        <p className="text-sm font-semibold text-white">{room || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-4">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/35">
                            <Plane className="h-3.5 w-3.5" /> {isEn ? 'Flight' : 'Voo'}
                        </p>
                        <p className="text-sm font-semibold text-white">{flightLabel(pilgrim.flight_option, isEn)}</p>
                    </div>
                </div>

                {notes.length > 0 && (
                    <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-white/[0.04] p-4">
                        <Luggage className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                        <div className="min-w-0">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/35">
                                {isEn ? 'Health & diet notes' : 'Saúde e alimentação'}
                            </p>
                            <p className="text-sm leading-snug text-white/60">{notes.join(' · ')}</p>
                        </div>
                    </div>
                )}

                <p className="mt-4 text-sm text-white/30">
                    {isEn
                        ? 'Something wrong? Talk to us and we will correct it.'
                        : 'Algo errado? Fala connosco e corrigimos.'}
                </p>
            </div>
        </div>
    );
}

function HelpCard({ isEn, pilgrimageTitle }: { isEn: boolean; pilgrimageTitle?: string | null }) {
    const whatsappLink = buildWhatsAppLink(
        pilgrimageTitle || undefined,
        isEn
            ? `Hello, I have a question about the logistics of ${pilgrimageTitle || 'my pilgrimage'}.`
            : `Olá, tenho uma dúvida sobre a logística da ${pilgrimageTitle || 'minha peregrinação'}.`,
        isEn,
    );

    return (
        <div className={`${CARD} px-5 py-5 md:px-6`}>
            <p className={LABEL}>{isEn ? 'Need help?' : 'Precisas de ajuda?'}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
                {isEn
                    ? 'Any doubt about flights, meeting points or your details — we answer quickly.'
                    : 'Qualquer dúvida sobre voos, pontos de encontro ou os teus dados — respondemos rápido.'}
            </p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
                <a
                    href="mailto:geral@apostoladodegarabandal.com"
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.08] px-4 text-sm font-bold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.14]"
                >
                    <Mail className="h-4 w-4" /> Email
                </a>
            </div>
        </div>
    );
}
