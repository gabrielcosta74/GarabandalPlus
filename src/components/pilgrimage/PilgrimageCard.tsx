"use client";

import { motion } from "framer-motion";
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Users, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pt as ptLocale, enUS } from 'date-fns/locale';
import { useCurrency } from "../providers/CurrencyProvider";
import { getPublicAvailabilityLabel, parseCivilDate } from '../../lib/utils';
import { useLocale } from '../../contexts/LocaleContext';


type PilgrimageCardProps = {
    pilgrimage: any;
    index: number;
};

const toSlug = (value?: string | null) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

export function PilgrimageCard({ pilgrimage, index }: PilgrimageCardProps) {
    const { formatPrice, currency } = useCurrency();
    const { locale, t } = useLocale();
    const dateLocale = locale === 'en' ? enUS : ptLocale;
    const p = t.pilgrimages;
    const startDate = parseCivilDate(pilgrimage.start_date);
    const endDate = parseCivilDate(pilgrimage.end_date);
    const confirmedPax = pilgrimage.confirmed_pax || 0;
    const effectiveVacanciesRaw = Number(pilgrimage.effective_vacancies);
    const currentVacanciesRaw = Number(pilgrimage.current_vacancies);
    const remainingSpots = Number.isFinite(effectiveVacanciesRaw)
        ? Math.max(0, effectiveVacanciesRaw)
        : Number.isFinite(currentVacanciesRaw)
            ? Math.max(0, currentVacanciesRaw)
            : Math.max(0, Number(pilgrimage.total_vacancies || 0) - Number(confirmedPax || 0));
    const isSoldOut = remainingSpots <= 0;
    const isClosed = pilgrimage.status === 'closed' || isSoldOut;
    const isWaitlist = !isClosed && pilgrimage.status === 'waitlist';
    const isLastSpots = !isClosed && !isWaitlist && remainingSpots > 0 && remainingSpots <= 5;
    const safeSlug = (pilgrimage.slug || '').trim() || toSlug(pilgrimage.title);
    const detailHref = safeSlug ? `/peregrinacoes/${safeSlug}` : '/peregrinacoes';

    // Status Logic & Styles
    let cardStyle = "bg-white border-slate-100 hover:border-yellow-500/30 hover:shadow-[0_20px_50px_-12px_rgba(37,99,235,0.1)]";
    let imageOverlay = "bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/5";
    let statusBadge;
    let actionButton;

    if (isClosed) {
        cardStyle = "bg-slate-50 border-slate-200 opacity-90 grayscale-[0.8] hover:grayscale-0 transition-all duration-500";
        imageOverlay = "bg-slate-900/40 mix-blend-multiply";
        statusBadge = (
            <div className="absolute top-4 left-4 z-20 -rotate-12 border-4 border-red-600 px-4 py-2 rounded-xl bg-red-600/10 backdrop-blur-sm">
                <span className="text-xl md:text-2xl font-black text-red-600 uppercase tracking-widest shadow-sm">
                    {p.card.soldOut}
                </span>
            </div>
        );
        actionButton = (
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest px-6 py-3 rounded-xl border-2 border-slate-200 bg-slate-100 cursor-not-allowed w-full md:w-auto text-center block">
                {p.card.unavailable}
            </span>
        );
    } else if (isWaitlist) {
        cardStyle = "bg-amber-50/30 border-amber-200 hover:border-amber-400 hover:shadow-[0_20px_50px_-12px_rgba(245,158,11,0.2)]";
        statusBadge = (
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                <span className="bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2 w-fit">
                    <Clock className="w-3.5 h-3.5" /> {p.card.waitlist}
                </span>
            </div>
        );
        actionButton = (
            <div className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm uppercase tracking-wide hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 group-hover:scale-105 duration-300 w-full md:w-auto">
                {p.card.joinWaitlist}
                <ChevronRight className="w-4 h-4" />
            </div>
        );
    } else if (isLastSpots) {
        statusBadge = (
            <span className="bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2 w-fit animate-pulse">
                <Clock className="w-3.5 h-3.5" /> {p.card.lastSpots}
            </span>
        );
        actionButton = (
            <div className="h-12 w-12 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:border-amber-500 group-hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-amber-500/30">
                <ChevronRight className="w-5 h-5" />
            </div>
        );
    } else {
        statusBadge = (
            <span className="bg-white/95 backdrop-blur-md text-green-700 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {p.card.open}
            </span>
        );
        actionButton = (
            <div className="h-12 w-12 rounded-full bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-yellow-500 group-hover:border-yellow-500 group-hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-yellow-500/30">
                <ChevronRight className="w-5 h-5" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -8 }}
            className="h-full"
        >
            <Link
                href={detailHref}
                className={`group rounded-3xl md:rounded-[2.5rem] border overflow-hidden flex flex-col md:flex-row h-full relative no-underline ${cardStyle}`}
            >
                {/* Image Section */}
                <div className="md:w-5/12 relative h-72 md:h-auto overflow-hidden">
                    {pilgrimage.cover_image ? (
                        <>
                            <Image
                                src={pilgrimage.cover_image}
                                alt={pilgrimage.title}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transform group-hover:scale-105 transition-transform duration-[1.5s]"
                            />
                            {/* Texture Overlay */}
                            <div className={`absolute inset-0 ${imageOverlay} transition-colors duration-500`} />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-slate-200" />
                    )}

                    {/* Badge */}
                    <div className="absolute top-6 left-6 z-10 w-full">
                        {statusBadge}
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-5 md:p-10 flex-1 flex flex-col justify-center relative">
                    <div className="flex items-center gap-3 text-yellow-600 text-xs font-bold uppercase tracking-wider mb-3">
                        <Calendar className="w-4 h-4" />
                        <span>
                            {format(startDate, "d MMM", { locale: dateLocale })} — {format(endDate, "d MMM, yyyy", { locale: dateLocale })}
                        </span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2 group-hover:text-yellow-600 transition-colors leading-tight">
                        {(locale === 'en' && pilgrimage.title_en) ? pilgrimage.title_en : pilgrimage.title}
                    </h3>

                    {(pilgrimage.itinerary_summary_en || pilgrimage.itinerary_summary) && (
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                            {(locale === 'en' && pilgrimage.itinerary_summary_en) ? pilgrimage.itinerary_summary_en : pilgrimage.itinerary_summary}
                        </p>
                    )}

                    <p className="text-slate-500 text-base leading-relaxed mb-8 line-clamp-3">
                        {(locale === 'en' && pilgrimage.description_en) ? pilgrimage.description_en : pilgrimage.description}
                    </p>

                    <div className="flex flex-col md:flex-row md:items-end justify-end border-t border-slate-100/50 pt-6 mt-auto gap-4">
                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-left md:text-right">
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">{p.card.availability}</span>
                                <div className={`flex items-center justify-start md:justify-end gap-1.5 text-sm font-bold ${isWaitlist ? 'text-amber-600' : isClosed ? 'text-red-600' : 'text-slate-700'}`}>
                                    <Users className="w-4 h-4" />
                                    {isClosed ? p.card.soldOut : isWaitlist ? p.card.waitlist : getPublicAvailabilityLabel(remainingSpots)}
                                </div>
                            </div>

                            {/* Dynamic Action Button */}
                            {actionButton}
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
