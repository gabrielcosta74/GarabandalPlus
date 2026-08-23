'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { HERO_IMAGE_URL, HERO_CONTENT } from './constants';
import { ChevronDown, ArrowRight, Heart, HandHeart } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';

const Hero: React.FC = () => {
    const { isAuthenticated, isMember, loading } = useAuth();
    const { t, locale } = useLocale();
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
    const textY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

    return (
        <section ref={ref} className="relative min-h-screen w-full overflow-hidden flex bg-slate-950">
            {/* The hero background is a CSS `background-image`, so the browser only
                discovers it after the stylesheet parses. Preloading it puts the
                request on the critical path immediately. React hoists this into
                <head>. */}
            {/* eslint-disable-next-line @next/next/no-head-element */}
            <link rel="preload" as="image" href={HERO_IMAGE_URL} fetchPriority="high" />
            {/* Full-bleed Background Image */}
            <motion.div
                style={{ opacity }}
                className="absolute inset-0 w-full h-full z-0"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:bg-[center_top_-2rem]"
                    style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
                />

                {/* Gradient Overlays for contrast */}
                {/* Mobile: dark from bottom up. Desktop: dark from left to right */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/10 lg:hidden" />
                <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
                {/* Extra subtle bottom gradient on desktop to ground the content */}
                <div className="hidden lg:block absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
            </motion.div>

            {/* Content Container */}
            <div className="relative z-20 w-full lg:w-[70%] xl:w-[60%] min-h-screen flex flex-col justify-end lg:justify-center px-6 sm:px-12 lg:px-20 xl:px-32 pb-24 pt-32 lg:py-0">
                <motion.div
                    style={{ y: textY }}
                    className="max-w-2xl"
                >
                    {/* Main Title — this is the LCP element, so it must NOT be
                        animated in. A `motion.h1` with `initial={{ opacity: 0 }}`
                        ships `style="opacity:0"` in the SSR HTML, so the browser
                        cannot paint it until the JS bundle downloads, React
                        hydrates and framer-motion runs. That was costing ~2.5s of
                        "element render delay" on mobile (LCP 3.5s). Keep it static. */}
                    <h1 className="font-serif text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] text-white font-bold mb-6 leading-[1.05] tracking-tight">
                        {locale === 'en' ? 'Garabandal Apostolate' : HERO_CONTENT.title}
                    </h1>

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
                        className="mb-10 sm:mb-12"
                    >
                        <p className="text-lg sm:text-xl md:text-2xl text-slate-300 font-light leading-relaxed max-w-xl">
                            {locale === 'en'
                                ? 'The official space of the Garabandal Apostolate — a non-profit association. A place of faith, prayer and sharing the Message.'
                                : HERO_CONTENT.subtitle}
                        </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
                    >
                        {/* Primary Button */}
                        {(!loading && isAuthenticated && isMember) ? (
                            <Link
                                href={t.urls.member}
                                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-garabandal-gold px-8 py-4 text-center text-base font-bold tracking-tight text-garabandal-dark transition-all duration-300 hover:-translate-y-0.5 hover:bg-yellow-400 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.7)]"
                            >
                                <span>{locale === 'en' ? 'Member Area' : 'Área de Membro'}</span>
                                <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        ) : (
                            <Link
                                href={t.urls.becomeMember}
                                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-garabandal-gold px-8 py-4 text-center text-base font-bold tracking-tight text-garabandal-dark transition-all duration-300 hover:-translate-y-0.5 hover:bg-yellow-400 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.7)]"
                            >
                                <span>{locale === 'en' ? 'Become a Member' : 'Tornar-se Membro'}</span>
                                <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        )}

                        {/* Secondary Actions - Glassmorphism */}
                        <div className="flex gap-3 sm:gap-4">
                            <Link
                                href={t.urls.donations}
                                className="group inline-flex flex-1 sm:flex-none min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 sm:px-6 py-4 text-center text-sm font-semibold tracking-wide text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:border-white/40"
                            >
                                <Heart size={18} className="shrink-0 text-white/80 group-hover:text-red-400 transition-colors" />
                                <span>{locale === 'en' ? 'Donate' : 'Doar'}</span>
                            </Link>

                            <Link
                                href={t.urls.intentions}
                                className="group inline-flex flex-1 sm:flex-none min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 sm:px-6 py-4 text-center text-sm font-semibold tracking-wide text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:border-white/40"
                            >
                                <HandHeart size={18} className="shrink-0 text-white/80 group-hover:text-sky-300 transition-colors" />
                                <span className="sm:hidden">{locale === 'en' ? 'Prayers' : 'Intenções'}</span>
                                <span className="hidden sm:inline">{locale === 'en' ? 'Prayer requests' : 'Pedidos de oração'}</span>
                            </Link>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-white/50"
                animate={{ y: [0, 8, 0], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
                <ChevronDown size={32} strokeWidth={2} />
            </motion.div>
        </section>
    );
};

export default Hero;
