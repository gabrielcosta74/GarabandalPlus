"use client";

import { motion } from "framer-motion";
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Users, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

type PilgrimageCardProps = {
    pilgrimage: any;
    index: number;
};

export function PilgrimageCard({ pilgrimage, index }: PilgrimageCardProps) {
    const startDate = new Date(pilgrimage.start_date);
    const endDate = new Date(pilgrimage.end_date);
    const isWaitlist = pilgrimage.status === 'waitlist';
    const isClosed = pilgrimage.status === 'closed';

    // Status Logic
    let statusBadge;
    if (isWaitlist) {
        statusBadge = (
            <span className="bg-white/95 backdrop-blur-md text-orange-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Lista de Espera
            </span>
        );
    } else if (isClosed) {
        statusBadge = (
            <span className="bg-white/95 backdrop-blur-md text-red-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Esgotado
            </span>
        );
    } else {
        const spotsLeft = pilgrimage.total_vacancies - pilgrimage.current_vacancies;
        // Removed "Últimas Vagas" logic as per request
        // const isUrgent = spotsLeft < 5;

        statusBadge = (
            <span className="bg-white/95 backdrop-blur-md text-green-700 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Inscrições Abertas
            </span>
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
                className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:border-yellow-500/30 transition-all hover:shadow-[0_20px_50px_-12px_rgba(37,99,235,0.1)] flex flex-col md:flex-row h-full relative"
            >
                {/* Image Section */}
                <div className="md:w-5/12 relative overflow-hidden h-72 md:h-auto overflow-hidden">
                    {pilgrimage.cover_image ? (
                        <div className="absolute inset-0 bg-slate-200">
                            <Image
                                src={pilgrimage.cover_image}
                                alt={pilgrimage.title}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transform group-hover:scale-110 transition-transform duration-[1.5s]"
                            />
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-slate-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/5" />

                    {/* Badge */}
                    <div className="absolute top-6 left-6 z-10">
                        {statusBadge}
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-6 md:p-10 flex-1 flex flex-col justify-center relative bg-gradient-to-b from-white to-slate-50/50">
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

                    <div className="flex items-end justify-between border-t border-slate-100 pt-6 mt-auto">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Valor por pessoa</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg text-slate-400 line-through font-medium decoration-red-400 decoration-2 opacity-60">
                                    {(pilgrimage.base_price * 1.15).toFixed(0)}€
                                </span>
                                <span className="text-3xl font-bold text-slate-900 tracking-tight">{pilgrimage.base_price}€</span>
                            </div>
                            <span className="text-sm text-green-600 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-md w-fit">
                                Preço Promocional
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:block text-right">
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">Disponibilidade</span>
                                <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-slate-700">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    {pilgrimage.current_vacancies} Lugares
                                </div>
                            </div>

                            <div className="h-12 w-12 rounded-full bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-yellow-500 group-hover:border-yellow-500 group-hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-yellow-500/30">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
