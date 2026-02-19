'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, MapPin, Star } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Pilgrimage {
    id: string;
    title: string;
    slug: string;
    cover_image: string;
    start_date: string;
    description: string;
    base_price: number;
    itinerary_summary?: string;
}

interface PilgrimageShowcaseProps {
    nextPilgrimage?: Pilgrimage | null;
}

const PilgrimageShowcase: React.FC<PilgrimageShowcaseProps> = ({ nextPilgrimage }) => {
    const containerRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    const yParallax = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
    const opacityFade = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
    const scaleAnim = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1, 1.1]);

    if (!nextPilgrimage) return null; // Or a graceful fallback

    const formattedDate = format(new Date(nextPilgrimage.start_date), "d 'de' MMMM, yyyy", { locale: pt });

    return (
        <section ref={containerRef} className="relative min-h-[90vh] flex items-center justify-center py-24 overflow-hidden bg-slate-900">
            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0 select-none pointer-events-none">
                <motion.div style={{ y: yParallax, scale: scaleAnim }} className="absolute inset-0 w-full h-[120%] -top-[10%]">
                    <Image
                        src={nextPilgrimage.cover_image || '/images/pilgrimage-placeholder.jpg'}
                        alt={nextPilgrimage.title}
                        fill
                        className="object-cover opacity-40 grayscale-[20%]"
                        priority
                    />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-slate-900/90" />
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 mix-blend-overlay" />
            </div>

            <div className="container mx-auto px-4 md:px-6 relative z-10 w-full">
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">

                    {/* Left: Content & Typography */}
                    <div className="lg:col-span-5 relative">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="space-y-8"
                        >
                            {/* Decorative Line */}
                            <div className="flex items-center gap-4">
                                <span className="h-[1px] w-12 bg-garabandal-gold/50" />
                                <span className="text-garabandal-gold text-xs font-bold uppercase tracking-[0.2em]">Próxima Peregrinação</span>
                            </div>

                            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] tracking-tight mb-6">
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200">
                                    {nextPilgrimage.title}
                                </span>
                            </h2>

                            <div className="flex items-start gap-3 border-l-2 border-garabandal-gold/30 pl-6 my-8">
                                <div className="space-y-4">
                                    <p className="text-lg text-slate-300 font-light leading-relaxed">
                                        {nextPilgrimage.description}
                                    </p>

                                    {nextPilgrimage.itinerary_summary && (
                                        <div className="flex items-center gap-3 text-garabandal-gold/90 bg-garabandal-gold/10 px-4 py-3 rounded-lg w-fit">
                                            <MapPin className="w-5 h-5 shrink-0" />
                                            <span className="font-medium text-sm tracking-wide uppercase">{nextPilgrimage.itinerary_summary}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                <Link href={`/peregrinacoes#${nextPilgrimage.slug}`} className="group relative">
                                    <div className="absolute inset-0 bg-garabandal-gold blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-500 rounded-lg"></div>
                                    <button className="cursor-pointer relative bg-garabandal-gold text-white px-8 py-4 rounded-lg font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-white hover:text-garabandal-gold transition-all duration-300 shadow-lg shadow-garabandal-gold/20">
                                        Ver Programa Completo
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </Link>
                                <Link href="/peregrinacoes">
                                    <button className="cursor-pointer px-8 py-4 rounded-lg border border-white/20 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors backdrop-blur-sm">
                                        Outras Datas
                                    </button>
                                </Link>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right: The "Card" / Visual Portal */}
                    <div className="lg:col-span-7 relative perspective-1000">
                        {/* Floating Glass Card */}
                        <motion.div
                            initial={{ opacity: 0, rotateY: 10, scale: 0.9 }}
                            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="relative aspect-[4/5] md:aspect-video lg:aspect-[4/5] max-h-[600px] w-full bg-slate-800 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 group"
                        >
                            <Image
                                src={nextPilgrimage.cover_image || '/images/pilgrimage-placeholder.jpg'}
                                alt={nextPilgrimage.title}
                                fill
                                className="object-cover transition-transform duration-[2s] ease-in-out group-hover:scale-110"
                            />

                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                            {/* Floating Info Elements */}
                            <div className="absolute top-6 right-6">
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center transform group-hover:-translate-y-2 transition-transform duration-500">
                                    <div className="text-xs uppercase tracking-widest text-white/60 mb-1">Partida</div>
                                    <div className="text-xl font-serif font-bold text-white">
                                        {format(new Date(nextPilgrimage.start_date), "dd", { locale: pt })}
                                    </div>
                                    <div className="text-xs font-bold text-garabandal-gold uppercase">
                                        {format(new Date(nextPilgrimage.start_date), "MMM", { locale: pt })}
                                    </div>
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-0 w-full p-8 md:p-10 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <MapPin className="w-4 h-4 text-garabandal-gold" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Destino Principal</span>
                                            </div>
                                            <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
                                                {nextPilgrimage.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                <span>Acompanhamento Espiritual Completo</span>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex flex-col items-end">
                                            <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Desde</span>
                                            <span className="text-2xl font-bold text-white">€{nextPilgrimage.base_price}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Background Splashes */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-garabandal-gold/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen animate-pulse" />
                        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PilgrimageShowcase;
