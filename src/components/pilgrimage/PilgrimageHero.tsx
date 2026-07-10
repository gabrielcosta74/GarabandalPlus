"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Star, Heart, Calendar, AlertTriangle, User } from "lucide-react";
import { useEffect, useState } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import { useLocale } from '../../contexts/LocaleContext';
import { getAvailabilityHighlightLabel, parseCivilDate } from '../../lib/utils';
import { supabaseBrowser } from '../../lib/supabase-browser';

interface FeaturedPilgrimage {
    id: string;
    title: string;
    title_en?: string | null;
    slug: string;
    cover_image?: string | null;
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
    const [heroImages, setHeroImages] = useState<string[]>(HERO_IMAGES);
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const dateLocale = isEn ? enUS : pt;
    const listHref = isEn ? '/en/pilgrimages' : '/peregrinacoes';
    const donationsHref = isEn ? '/en/donations' : '/donations';

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % heroImages.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [heroImages.length]);

    useEffect(() => {
        let mounted = true;
        const fetchGalleryImages = async () => {
            if (!supabaseBrowser) return;

            const { data } = await supabaseBrowser
                .from('gallery_images')
                .select('image_url')
                .eq('is_active', true)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false })
                .limit(8);

            if (mounted && data?.length) {
                const urls = data.map((image) => image.image_url).filter(Boolean);
                if (urls.length) setHeroImages(urls);
            }
        };

        fetchGalleryImages();

        return () => {
            mounted = false;
        };
    }, []);

    // Date Formatting
    const dateFormatted = featuredPilgrimage ?
        (isEn
            ? `${format(parseCivilDate(featuredPilgrimage.start_date), "MMM d", { locale: dateLocale })} - ${format(parseCivilDate(featuredPilgrimage.end_date), "MMM d, yyyy", { locale: dateLocale })}`
            : `${format(parseCivilDate(featuredPilgrimage.start_date), "d MMM", { locale: dateLocale })} - ${format(parseCivilDate(featuredPilgrimage.end_date), "d MMM, yyyy", { locale: dateLocale })}`)
        : "";
    const remainingSpots = featuredPilgrimage
        ? Number.isFinite(Number(featuredPilgrimage.effective_vacancies))
            ? Math.max(0, Number(featuredPilgrimage.effective_vacancies))
            : Number.isFinite(Number(featuredPilgrimage.current_vacancies))
                ? Math.max(0, Number(featuredPilgrimage.current_vacancies))
                : Math.max(0, Number(featuredPilgrimage.total_vacancies || 0) - Number(featuredPilgrimage.confirmed_pax || 0))
        : 0;

    return (
        <div className="relative overflow-hidden rounded-b-3xl md:rounded-none md:rounded-b-[3rem] bg-slate-900 text-white min-h-[720px] sm:min-h-[760px] md:min-h-[650px] flex items-center mb-8 md:mb-14 shadow-2xl group transition-all duration-1000 pt-28 pb-12 md:pt-36 md:pb-16">
            {/* Dynamic Background */}
            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentImage}
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 z-0"
                >
                    <Image
                        src={heroImages[currentImage] || HERO_IMAGES[0]}
                        alt={isEn ? "Garabandal pilgrimage moments" : "Momentos de peregrinação a Garabandal"}
                        fill
                        className="object-cover object-center md:object-[center_top]"
                        priority
                        quality={85}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Gradients */}
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-slate-950/88 via-slate-950/52 to-slate-950/20" />
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950/86 via-slate-900/10 to-transparent" />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center h-full">

                {/* Left: Brand Story */}
                <div className="space-y-6 md:space-y-8 py-0 md:py-10 max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/12 border border-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-yellow-200 mb-6 md:mb-8 shadow-glow">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            {isEn ? 'Supporting the Construction' : 'Apoio à Construção'}
                        </div>
                        <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.98] mb-5 md:mb-8 lg:tracking-tight">
                            {isEn ? <>Catholic Marian <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-500">Pilgrimages</span></> : <>Peregrinações Marianas <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-500">Católicas</span></>}
                        </h1>
                        <p className="text-base sm:text-lg md:text-xl text-slate-100 leading-relaxed font-medium border-l-0 lg:border-l-2 border-yellow-400/60 pl-0 lg:pl-6 text-center lg:text-left mx-auto lg:mx-0 max-w-lg drop-shadow">
                            {isEn ? <>Organised spiritual journeys to Garabandal, Fatima and Iberian Catholic shrines with the <strong className="text-white font-serif">Apostolate of Garabandal</strong>. Every step helps build the future of the mission.</> : <>Viagens espirituais organizadas a Garabandal, Fátima e santuários católicos ibéricos com o <strong className="text-white font-serif">Apostolado de Garabandal</strong>. Cada passo ajuda a construir o futuro da missão.</>}
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6 pt-4"
                    >
                        {/* Cause Button */}
                        <Link href={donationsHref} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm transition-all group">
                            <Heart className="w-5 h-5 text-red-500 fill-red-500 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-white">{isEn ? 'Learn about the Project' : 'Conhecer o Projeto'}</span>
                        </Link>

                        {/* Trust Pill */}
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                            <Star className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-medium text-slate-400">{isEn ? 'Official Spiritual Guide' : 'Guia Espiritual Oficial'}</span>
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
                            className="relative w-full max-w-[420px] bg-white/14 backdrop-blur-2xl rounded-[1.75rem] md:rounded-[2.25rem] border border-white/25 p-2 shadow-2xl hover:scale-[1.01] transition-transform duration-500"
                        >
                            {/* Card Inner */}
                            <div className="min-h-[390px] bg-slate-900/88 rounded-[1.35rem] md:rounded-[1.9rem] p-5 sm:p-6 lg:p-7 flex flex-col justify-between relative overflow-hidden group">
                                {(featuredPilgrimage.cover_image || heroImages[currentImage]) && (
                                    <>
                                        <Image
                                            src={featuredPilgrimage.cover_image || heroImages[currentImage]}
                                            alt={isEn ? featuredPilgrimage.title_en || featuredPilgrimage.title : featuredPilgrimage.title}
                                            fill
                                            className="object-cover opacity-55"
                                            sizes="(max-width: 768px) 100vw, 380px"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/82 to-slate-950/40" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/25 to-transparent" />
                                    </>
                                )}
                                {/* Glow Effect */}
                                <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400/15 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2" />

                                <div className="relative space-y-5">
                                    <div className="flex flex-col gap-3">
                                        {remainingSpots > 0 ? (
                                            remainingSpots <= 5 ? (
                                                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-yellow-300 shadow-[0_0_30px_rgba(251,191,36,0.5)] p-4 sm:p-5">
                                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                                                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="animate-pulse">
                                                                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-950" />
                                                            </div>
                                                            <h4 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-amber-950 drop-shadow-sm">
                                                                {isEn ? `ONLY ${remainingSpots} SPOTS LEFT` : `RESTAM APENAS ${remainingSpots} VAGAS`}
                                                            </h4>
                                                            <div className="animate-pulse">
                                                                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-950" />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-1">
                                                            {Array.from({ length: remainingSpots }).map((_, i) => (
                                                                <div key={i} className="bg-white/30 p-2 sm:p-2.5 rounded-full border border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                                                                    <User className="w-6 h-6 sm:w-8 sm:h-8 text-amber-950 fill-amber-950" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-wide bg-amber-900/10 px-4 py-2 rounded-xl border border-amber-900/20 w-full">
                                                            {isEn ? "Spots go quickly! Don't miss out." : "Atenção: Estas vagas esgotam rápido."}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-yellow-300 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-950 shadow-sm">
                                                        {isEn ? 'November still available' : 'Novembro ainda disponível'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-950/30 ring-2 ring-white/80">
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                        {getAvailabilityHighlightLabel(remainingSpots, locale, featuredPilgrimage)}
                                                    </span>
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/30 ring-2 ring-white/80">
                                                    {isEn ? 'Waiting list' : 'Lista de espera'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-2xl sm:text-3xl md:text-[2rem] font-serif font-bold text-white leading-[1.08] drop-shadow">
                                            {isEn ? featuredPilgrimage.title_en || featuredPilgrimage.title : featuredPilgrimage.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-white text-sm font-bold">
                                            <Calendar className="w-4 h-4 text-yellow-300" />
                                            {dateFormatted}
                                        </div>
                                    </div>
                                </div>

                                {/* Divider with notches */}
                                <div className="relative my-5 flex items-center justify-between">
                                    <div className="w-4 h-4 rounded-full bg-slate-900 absolute -left-7 md:-left-8" />
                                    <div className="border-t-2 border-dashed border-white/20 w-full" />
                                    <div className="w-4 h-4 rounded-full bg-slate-900 absolute -right-7 md:-right-8" />
                                </div>

                                <div className="relative mt-auto space-y-4">
                                    <p className="text-sm sm:text-base leading-relaxed text-slate-100 font-medium">
                                        {isEn ? 'Learn the programme first, then continue to registration from the pilgrimage page.' : 'Conheça primeiro o programa e avance para a inscrição apenas na página da peregrinação.'}
                                    </p>
                                    <Link href={`${listHref}/${featuredPilgrimage.slug}`} className="block w-full">
                                        <span className="w-full min-h-14 bg-yellow-300 hover:bg-yellow-200 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-xl shadow-yellow-900/25 ring-1 ring-yellow-100/60 group-hover:translate-y-[-2px]">
                                            {isEn ? 'Learn More' : 'Saber Mais'}
                                            <ArrowRight className="w-4 h-4" />
                                        </span>
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
