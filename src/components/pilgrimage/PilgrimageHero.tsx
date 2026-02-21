"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Star, Heart, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useCurrency } from "../providers/CurrencyProvider";

interface FeaturedPilgrimage {
    id: string;
    title: string;
    slug: string;
    start_date: string;
    end_date: string;
    base_price: number;
    total_vacancies: number;
    current_vacancies?: number;
    confirmed_pax: number;
    effective_vacancies: number;
}

const HERO_IMAGES = [
    "/images/aldeiadacasa.webp", // Landscape
    "/images/igrejagarabandal.webp", // People/Cross
    "/images/casaantes1.webp"  // Journey
];

export function PilgrimageHero({ featuredPilgrimage }: { featuredPilgrimage?: FeaturedPilgrimage }) {
    const [currentImage, setCurrentImage] = useState(0);
    const { formatPrice, currency } = useCurrency();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % HERO_IMAGES.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    // Date Formatting
    const dateFormatted = featuredPilgrimage ?
        `${format(new Date(featuredPilgrimage.start_date), "d MMM", { locale: pt })} - ${format(new Date(featuredPilgrimage.end_date), "d MMM, yyyy", { locale: pt })}`
        : "";

    return (
        <div className="relative overflow-hidden md:rounded-[2.5rem] rounded-b-3xl bg-slate-900 text-white min-h-[auto] md:min-h-[650px] flex items-center mb-12 md:mb-16 shadow-2xl group transition-all duration-1000 py-12 md:py-0">
            {/* Dynamic Background */}
            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentImage}
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 0.5, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 z-0"
                >
                    <Image
                        src={HERO_IMAGES[currentImage]}
                        alt="Garabandal Pilgrimage"
                        fill
                        className="object-cover object-center md:object-[center_top]"
                        priority
                        quality={85}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Gradients */}
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent" />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center h-full">

                {/* Left: Brand Story */}
                <div className="space-y-8 py-0 md:py-10 max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-indigo-300 mb-8 shadow-glow">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            Apoio à Construção
                        </div>
                        <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.95] mb-6 md:mb-8 lg:tracking-tight">
                            Onde o Céu <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-500">Toca a Terra</span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-light border-l-0 lg:border-l-2 border-indigo-500/50 pl-0 lg:pl-6 text-center lg:text-left mx-auto lg:mx-0 max-w-lg">
                            Cada passo seu nesta jornada ajuda a erguer a <strong className="text-white font-serif">Casa do Apostolado</strong>. Peregrinar connosco é viver a fé e construir o futuro da missão.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6 pt-4"
                    >
                        {/* Cause Button */}
                        <Link href="/donations" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm transition-all group">
                            <Heart className="w-5 h-5 text-red-500 fill-red-500 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-white">Conhecer o Projeto</span>
                        </Link>

                        {/* Trust Pill */}
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                            <Star className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-medium text-slate-400">Guia Espiritual Oficial</span>
                        </div>
                    </motion.div>
                </div>

                {/* Right: Featured Trip Card - The "Hero" of the Hero */}
                <div className="relative flex justify-center lg:justify-end">
                    {featuredPilgrimage ? (
                        <motion.div
                            initial={{ opacity: 0, x: 50, rotate: 2 }}
                            animate={{ opacity: 1, x: 0, rotate: 0 }}
                            transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
                            className="relative w-full max-w-sm bg-white/10 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 p-2 shadow-2xl hover:scale-[1.02] transition-transform duration-500"
                        >
                            {/* Card Inner */}
                            <div className="bg-slate-900/80 rounded-[2rem] p-6 lg:p-8 space-y-6 relative overflow-hidden group">
                                {/* Glow Effect */}
                                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2" />

                                <div className="space-y-2 relative">
                                    <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Próxima Partida</span>
                                    <h3 className="text-3xl font-serif font-bold text-white leading-none">
                                        {featuredPilgrimage.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-300 text-sm font-medium pt-2">
                                        <Calendar className="w-4 h-4 text-yellow-500" />
                                        {dateFormatted}
                                    </div>
                                </div>

                                {/* Divider with notches */}
                                <div className="relative flex items-center justify-between">
                                    <div className="w-4 h-4 rounded-full bg-slate-900 absolute -left-8" />
                                    <div className="border-t-2 border-dashed border-white/10 w-full" />
                                    <div className="w-4 h-4 rounded-full bg-slate-900 absolute -right-8" />
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative">
                                    <div>
                                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Valor Base</span>
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-bold text-white tracking-tight">{formatPrice(featuredPilgrimage.base_price)}</span>
                                                {/* Fake strikethrough for marketing */}
                                                <span className="text-xs line-through text-slate-500 decoration-red-500">{formatPrice(featuredPilgrimage.base_price * 1.15)}</span>
                                            </div>
                                            {currency === 'BRL' && (
                                                <span className="text-[9px] text-yellow-500/80 font-bold uppercase tracking-tighter">* Câmbio automático para Reais</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Vagas</span>
                                        <span className="text-sm font-bold text-green-400 flex items-center justify-end gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            {Number.isFinite(Number(featuredPilgrimage.effective_vacancies))
                                                ? Number(featuredPilgrimage.effective_vacancies)
                                                : Number.isFinite(Number((featuredPilgrimage as any).current_vacancies))
                                                    ? Math.max(0, Number((featuredPilgrimage as any).current_vacancies))
                                                    : Math.max(0, Number(featuredPilgrimage.total_vacancies || 0) - Number(featuredPilgrimage.confirmed_pax || 0))
                                            } Restantes
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Link href={`/peregrinacoes/${featuredPilgrimage.slug}`} className="block w-full">
                                        <button className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-yellow-500/25 group-hover:translate-y-[-2px]">
                                            Saber Mais
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        // Fallback/Skeleton content if no trip
                        <div className="h-64 w-full max-w-sm rounded-[2.5rem] bg-white/5 animate-pulse" />
                    )}
                </div>
            </div>
        </div >
    );
}
