"use client";

import { motion } from "framer-motion";
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Users, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useCurrency } from "../providers/CurrencyProvider";

type PilgrimageCardProps = {
    pilgrimage: any;
    index: number;
};

export function PilgrimageCard({ pilgrimage, index }: PilgrimageCardProps) {
    const { formatPrice, currency } = useCurrency();
    const startDate = new Date(pilgrimage.start_date);
    const endDate = new Date(pilgrimage.end_date);
    const confirmedPax = pilgrimage.confirmed_pax || 0;
    const effectiveVacanciesRaw = Number(pilgrimage.effective_vacancies);
    const currentVacanciesRaw = Number(pilgrimage.current_vacancies);
    const remainingSpots = Number.isFinite(effectiveVacanciesRaw)
        ? Math.max(0, effectiveVacanciesRaw)
        : Number.isFinite(currentVacanciesRaw)
            ? Math.max(0, currentVacanciesRaw)
            : Math.max(0, Number(pilgrimage.total_vacancies || 0) - Number(confirmedPax || 0));
    const isWaitlist = pilgrimage.status === 'waitlist' || (remainingSpots <= 0 && pilgrimage.status !== 'closed');
    const isClosed = pilgrimage.status === 'closed';

    // Status Logic & Styles
    let cardStyle = "bg-white border-slate-100 hover:border-yellow-500/30 hover:shadow-[0_20px_50px_-12px_rgba(37,99,235,0.1)]";
    let imageOverlay = "bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/5";
    let statusBadge;
    let actionButton;

    if (isClosed) {
        // SOLD OUT STYLE
        cardStyle = "bg-slate-50 border-slate-200 opacity-90 grayscale-[0.8] hover:grayscale-0 transition-all duration-500";
        imageOverlay = "bg-slate-900/40 mix-blend-multiply";
        statusBadge = (
            <div className="absolute top-4 left-4 z-20 -rotate-12 border-4 border-red-600 px-4 py-2 rounded-xl bg-red-600/10 backdrop-blur-sm">
                <span className="text-xl md:text-2xl font-black text-red-600 uppercase tracking-widest shadow-sm">
                    Esgotado
                </span>
            </div>
        );
        actionButton = (
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest px-6 py-3 rounded-xl border-2 border-slate-200 bg-slate-100 cursor-not-allowed">
                Indisponível
            </span>
        );
    } else if (isWaitlist) {
        // WAITLIST FOMO STYLE
        cardStyle = "bg-amber-50/30 border-amber-200 hover:border-amber-400 hover:shadow-[0_20px_50px_-12px_rgba(245,158,11,0.2)]";
        statusBadge = (
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                <span className="bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2 w-fit animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> Últimas Vagas
                </span>
            </div>
        );
        actionButton = (
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm uppercase tracking-wide hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 group-hover:scale-105 duration-300">
                Entrar em Lista de Espera
                <ChevronRight className="w-4 h-4" />
            </div>
        );
    } else {
        // OPEN STYLE
        statusBadge = (
            <span className="bg-white/95 backdrop-blur-md text-green-700 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Inscrições Abertas
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
                href={`/peregrinacoes/${pilgrimage.slug}`}
                className={`group rounded-[2.5rem] border overflow-hidden flex flex-col md:flex-row h-full relative no-underline ${cardStyle}`}
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
                <div className="p-6 md:p-10 flex-1 flex flex-col justify-center relative">
                    <div className="flex items-center gap-3 text-yellow-600 text-xs font-bold uppercase tracking-wider mb-3">
                        <Calendar className="w-4 h-4" />
                        <span>
                            {format(startDate, "d MMM", { locale: pt })} a {format(endDate, "d MMM, yyyy", { locale: pt })}
                        </span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2 group-hover:text-yellow-600 transition-colors leading-tight">
                        {pilgrimage.title}
                    </h3>

                    {pilgrimage.itinerary_summary && (
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                            {pilgrimage.itinerary_summary}
                        </p>
                    )}

                    <p className="text-slate-500 text-base leading-relaxed mb-8 line-clamp-3">
                        {pilgrimage.description}
                    </p>

                    <div className="flex items-end justify-between border-t border-slate-100/50 pt-6 mt-auto">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Valor por pessoa</span>
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg text-slate-400 line-through font-medium decoration-red-400 decoration-2 opacity-60">
                                        {formatPrice(pilgrimage.base_price * 1.15)}
                                    </span>
                                    <span className={`text-3xl font-bold tracking-tight ${isClosed ? 'text-slate-400' : 'text-slate-900'}`}>
                                        {formatPrice(pilgrimage.base_price)}
                                    </span>
                                </div>
                                {currency === 'BRL' && (
                                    <span className="text-[9px] text-yellow-600 font-bold uppercase tracking-tighter mt-1 italic">
                                        * Câmbio Automático
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:block text-right">
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">Disponibilidade</span>
                                <div className={`flex items-center justify-end gap-1.5 text-sm font-bold ${isWaitlist ? 'text-amber-600' : 'text-slate-700'}`}>
                                    <Users className="w-4 h-4" />
                                    {isClosed ? 'Esgotado' : `${remainingSpots} Lugares`}
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
