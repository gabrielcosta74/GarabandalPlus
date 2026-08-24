'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, MapPin, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import { parseCivilDate } from '../../lib/utils';
import { useLocale } from '../../contexts/LocaleContext';
import { useCurrency } from '../providers/CurrencyProvider';
import { PilgrimagePrice } from '../pilgrimage/PilgrimagePrice';
import { richTextToPlain } from '../../lib/rich-text';

interface Pilgrimage {
    id: string;
    title: string;
    slug: string;
    cover_image: string;
    cover_image_en?: string | null;
    start_date: string;
    end_date?: string;
    description: string;
    base_price: number;
    itinerary_summary?: string;
    status: 'draft' | 'open' | 'closed' | 'completed' | 'waitlist' | 'full';
    total_vacancies: number;
    confirmed_pax: number;
    effective_vacancies?: number | null;
}

interface PilgrimageShowcaseProps {
    pilgrimages: Pilgrimage[];
}

const PilgrimageShowcase: React.FC<PilgrimageShowcaseProps> = ({ pilgrimages }) => {
    const containerRef = useRef<HTMLElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { t, locale } = useLocale();
    const isEn = locale === 'en';
    const dateLocale = isEn ? enUS : pt;
    const { currency, formatEUR } = useCurrency();

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    const yParallax = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
    const opacityFade = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

    if (!pilgrimages || pilgrimages.length === 0) return null;

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
        }
    };

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
        }
    };

    const pilgrimagesHref = t.urls.pilgrimages;

    return (
        <section ref={containerRef} className="relative min-h-[90vh] flex flex-col justify-center py-24 overflow-hidden bg-slate-900 border-t border-white/5">
            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0 select-none pointer-events-none">
                <motion.div style={{ y: yParallax, opacity: opacityFade }} className="absolute inset-0 w-full h-[120%] -top-[10%]">
                    <Image
                        src={(isEn && pilgrimages[0].cover_image_en) || pilgrimages[0].cover_image || '/images/pilgrimage-placeholder.jpg'}
                        alt="Background Texture"
                        fill
                        className="object-cover opacity-10 grayscale-[50%] blur-xl"
                        priority
                    />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900" />
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 mix-blend-overlay" />
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-garabandal-gold/10 rounded-full blur-[120px]" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="container mx-auto px-4 md:px-6 relative z-10 w-full mb-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="max-w-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <span className="h-[1px] w-8 bg-garabandal-gold/50" />
                            <span className="text-garabandal-gold text-xs font-bold uppercase tracking-[0.2em]">
                                {isEn ? 'Spiritual Journeys' : 'Viagens Espirituais'}
                            </span>
                        </div>
                        <h2 className="font-serif text-3xl md:text-5xl lg:text-5xl text-white leading-[1.1] tracking-tight">
                            {isEn
                                ? <>Discover Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-garabandal-gold to-yellow-200">Upcoming Pilgrimages</span></>
                                : <>Descubra as Nossas <span className="text-transparent bg-clip-text bg-gradient-to-r from-garabandal-gold to-yellow-200">Próximas Peregrinações</span></>}
                        </h2>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex items-center gap-4"
                    >
                        <Link href={pilgrimagesHref} className="text-sm font-bold text-white/70 tracking-widest uppercase hover:text-white transition-colors flex items-center gap-2 text-right">
                            {isEn ? 'View All Pilgrimages' : 'Ver Todas as Peregrinações'} <ChevronRight className="w-4 h-4" />
                        </Link>
                    </motion.div>
                </div>
            </div>

            {/* Horizontal Scroll Gallery */}
            <div className="relative z-20 w-full pb-8 group/slider">
                {/* Desktop Navigation Arrows */}
                <button
                    onClick={scrollLeft}
                    className="hidden md:flex absolute left-4 xl:left-12 top-1/2 -translate-y-1/2 z-30 w-14 h-14 rounded-full bg-slate-900/90 border border-white/20 text-white items-center justify-center hover:bg-garabandal-gold hover:text-garabandal-dark hover:border-transparent transition-all backdrop-blur-md shadow-2xl opacity-0 group-hover/slider:opacity-100"
                    aria-label={isEn ? 'Previous' : 'Anterior'}
                >
                    <ChevronRight className="w-8 h-8 rotate-180" />
                </button>

                <button
                    onClick={scrollRight}
                    className="hidden md:flex absolute right-4 xl:right-12 top-1/2 -translate-y-1/2 z-30 w-14 h-14 rounded-full bg-slate-900/90 border border-white/20 text-white items-center justify-center hover:bg-garabandal-gold hover:text-garabandal-dark hover:border-transparent transition-all backdrop-blur-md shadow-2xl opacity-0 group-hover/slider:opacity-100"
                    aria-label={isEn ? 'Next' : 'Próximo'}
                >
                    <ChevronRight className="w-8 h-8" />
                </button>

                {/* Scroll Hint Gradients */}
                <div className="absolute left-0 top-0 bottom-8 w-8 md:w-24 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-8 w-12 md:w-32 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent z-10 pointer-events-none flex items-center justify-end pr-4 md:pr-8">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                        className="md:hidden text-white/50"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.div>
                </div>

                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto gap-6 px-4 md:px-6 xl:px-[calc((100vw-1280px)/2+24px)] snap-x snap-mandatory scrollbar-hide pb-8 pt-4 relative pr-20 md:pr-32"
                    style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
                >
                    {pilgrimages.map((pilgrimage, index) => {
                        const startDate = parseCivilDate(pilgrimage.start_date);
                        const effectiveVacancies = pilgrimage.effective_vacancies ?? (pilgrimage.total_vacancies - pilgrimage.confirmed_pax);

                        let badgeType = 'default';
                        let badgeText = '';

                        if (pilgrimage.status === 'full' || pilgrimage.status === 'closed' || effectiveVacancies <= 0) {
                            badgeType = 'danger';
                            badgeText = isEn ? 'Sold Out' : 'Esgotado';
                        } else if (pilgrimage.status === 'waitlist') {
                            badgeType = 'warning';
                            badgeText = isEn ? 'Waitlist' : 'Lista de Espera';
                        } else if (effectiveVacancies <= 5) {
                            badgeType = 'urgent';
                            badgeText = isEn
                                ? `Last ${effectiveVacancies} ${effectiveVacancies === 1 ? 'Spot' : 'Spots'}!`
                                : `Últimas ${effectiveVacancies} ${effectiveVacancies === 1 ? 'Vaga' : 'Vagas'}!`;
                        } else if (effectiveVacancies <= 10) {
                            badgeType = 'attention';
                            badgeText = isEn ? 'Nearly Full' : 'Quase Cheio';
                        }

                        // Card link: go to the pilgrimages list page anchored to this slug
                        const cardHref = `${pilgrimagesHref}#${pilgrimage.slug}`;

                        return (
                            <motion.div
                                key={pilgrimage.id}
                                initial={{ opacity: 0, x: 50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="snap-center shrink-0 w-[300px] md:w-[400px] group perspective-1000"
                            >
                                <Link
                                    href={cardHref}
                                    className={`block relative aspect-[4/5] bg-slate-800 rounded-[2rem] overflow-hidden shadow-2xl border transition-all duration-500 hover:-translate-y-2 hover:shadow-garabandal-gold/20
                                        ${badgeType === 'danger' ? 'border-red-500/30 hover:border-red-400/50 grayscale-[50%]' : 'border-white/10 hover:border-white/20'}`}
                                >
                                    <Image
                                        src={(isEn && pilgrimage.cover_image_en) || pilgrimage.cover_image || '/images/pilgrimage-placeholder.jpg'}
                                        alt={pilgrimage.title}
                                        fill
                                        className="object-cover transition-transform duration-[2s] ease-in-out group-hover:scale-110"
                                        sizes="(max-width: 768px) 300px, 400px"
                                    />

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40" />

                                    {/* Badge */}
                                    {badgeText && (
                                        <div className="absolute top-5 left-5 z-20">
                                            <div className={`
                                                px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-lg border
                                                ${badgeType === 'danger' ? 'bg-red-950/80 text-red-200 border-red-500/50' : ''}
                                                ${badgeType === 'warning' ? 'bg-orange-950/80 text-orange-200 border-orange-500/50' : ''}
                                                ${badgeType === 'urgent' ? 'bg-yellow-500 text-slate-900 border-yellow-400 animate-pulse' : ''}
                                                ${badgeType === 'attention' ? 'bg-garabandal-gold/20 text-garabandal-gold border-garabandal-gold/50' : ''}
                                            `}>
                                                {badgeText}
                                            </div>
                                        </div>
                                    )}

                                    {/* Date Badge */}
                                    <div className={`absolute top-5 right-5 z-20 transition-transform duration-500 ${badgeText ? 'group-hover:-translate-y-1' : ''}`}>
                                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-center shadow-lg shadow-black/20">
                                            <div className="text-xl font-serif font-bold text-white leading-none">
                                                {format(startDate, "dd", { locale: dateLocale })}
                                            </div>
                                            <div className="text-[10px] font-bold text-garabandal-gold uppercase tracking-wider mt-1">
                                                {format(startDate, "MMM", { locale: dateLocale })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col justify-end z-10">
                                        {pilgrimage.itinerary_summary && (
                                            <div className="flex items-center gap-2 mb-3">
                                                <MapPin className="w-3 h-3 text-garabandal-gold" />
                                                <span className="text-xs font-bold uppercase tracking-widest text-garabandal-gold line-clamp-1">
                                                    {pilgrimage.itinerary_summary}
                                                </span>
                                            </div>
                                        )}

                                        <h3 className="text-2xl font-serif font-bold text-white mb-2 leading-tight group-hover:text-garabandal-gold transition-colors">
                                            {pilgrimage.title}
                                        </h3>

                                        <p className="text-sm text-slate-300 line-clamp-2 mb-6">
                                            {richTextToPlain(pilgrimage.description)}
                                        </p>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                                                    {isEn ? 'From' : 'A partir de'}
                                                </span>
                                                {currency === 'EUR' ? (
                                                    <span className="text-xl font-bold text-white">
                                                        {formatEUR(pilgrimage.base_price)}
                                                    </span>
                                                ) : (
                                                    <PilgrimagePrice
                                                        amountInEur={pilgrimage.base_price}
                                                        layout="showcase"
                                                        secondaryClassName="text-xl"
                                                    />
                                                )}
                                            </div>

                                            <div className={`w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border transition-all duration-300
                                                ${badgeType === 'danger' || badgeType === 'warning'
                                                    ? 'border-white/10 text-white/50 group-hover:bg-white/20'
                                                    : 'border-white/20 text-white group-hover:bg-garabandal-gold group-hover:text-garabandal-dark group-hover:border-transparent'
                                                }`}>
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hover glow */}
                                    <div className={`absolute inset-0 border-2 rounded-[2rem] transition-colors duration-500 pointer-events-none
                                        ${badgeType === 'danger' ? 'border-red-500/0 group-hover:border-red-500/30' : 'border-garabandal-gold/0 group-hover:border-garabandal-gold/50'}`}
                                    />
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </section>
    );
};

export default PilgrimageShowcase;
