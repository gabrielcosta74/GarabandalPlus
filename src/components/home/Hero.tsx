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
        <section ref={ref} className="relative min-h-screen w-full overflow-hidden flex bg-garabandal-mist">
            {/* Left Content Half */}
            <div className="relative z-20 w-full lg:w-[55%] min-h-screen flex flex-col justify-end lg:justify-center px-6 sm:px-12 lg:px-20 xl:px-32 pb-28 pt-32 lg:py-0">
                <motion.div
                    style={{ y: textY }}
                    className="max-w-2xl"
                >
                    {/* Main Title */}
                    <motion.h1
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                        className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] text-white lg:text-garabandal-dark drop-shadow-xl lg:drop-shadow-none mb-5 sm:mb-6 leading-[1.05] tracking-tight"
                    >
                        {locale === 'en' ? 'Garabandal Apostolate' : HERO_CONTENT.title}
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
                        className="mb-8 sm:mb-10"
                    >
                        <p className="text-base sm:text-lg md:text-xl text-white/90 lg:text-slate-600 font-sans font-medium leading-relaxed drop-shadow lg:drop-shadow-none">
                            {locale === 'en'
                                ? 'The official space of the Garabandal Apostolate Association. A place of faith, prayer and sharing the Message.'
                                : HERO_CONTENT.subtitle}
                        </p>
                    </motion.div>

                    {/* Mobile: primary CTA full-width on top, two secondary actions
                        below in a 2-col grid (avoids the 3-in-a-row overflow).
                        sm+ restores a single inline row. */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
                        className="grid w-full max-w-md grid-cols-2 gap-2.5 sm:max-w-none sm:flex sm:flex-row sm:items-stretch sm:gap-3"
                    >
                        {(!loading && isAuthenticated && isMember) ? (
                            <Link
                                href={t.urls.member}
                                className="group col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-garabandal-gold px-5 py-4 text-center text-base font-bold tracking-tight text-garabandal-dark ring-1 ring-garabandal-gold/50 shadow-[0_10px_28px_-6px_rgba(212,175,55,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#c9a431] hover:shadow-[0_14px_34px_-8px_rgba(212,175,55,0.85)] sm:flex-[1.5]"
                            >
                                <span className="truncate">{locale === 'en' ? 'Member Area' : 'Área de Membro'}</span>
                                <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>

                        ) : (
                            <Link
                                href={t.urls.becomeMember}
                                className="group col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-garabandal-gold px-5 py-4 text-center text-base font-bold tracking-tight text-garabandal-dark ring-1 ring-garabandal-gold/50 shadow-[0_10px_28px_-6px_rgba(212,175,55,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#c9a431] hover:shadow-[0_14px_34px_-8px_rgba(212,175,55,0.85)] sm:flex-[1.5]"
                            >
                                <span className="truncate">{locale === 'en' ? 'Become a Member' : 'Tornar-se Membro'}</span>
                                <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        )}

                        <Link
                            href={t.urls.donations}
                            className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/15 px-3 py-4 text-center text-sm font-semibold tracking-tight text-white ring-1 ring-white/30 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/25 sm:flex-1 sm:bg-white sm:text-garabandal-dark sm:ring-garabandal-gold/30 sm:shadow-[0_6px_20px_-8px_rgba(15,23,42,0.25)] sm:backdrop-blur-none sm:hover:bg-white"
                        >
                            <Heart size={17} className="shrink-0 text-white transition-transform duration-300 group-hover:scale-110 sm:text-garabandal-gold" />
                            <span className="truncate">{locale === 'en' ? 'Donate' : 'Doar'}</span>
                        </Link>

                        <Link
                            href={t.urls.intentions}
                            className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/15 px-3 py-4 text-center text-sm font-semibold tracking-tight text-white ring-1 ring-white/30 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/25 sm:flex-1 sm:bg-white sm:text-garabandal-dark sm:ring-garabandal-gold/30 sm:shadow-[0_6px_20px_-8px_rgba(15,23,42,0.25)] sm:backdrop-blur-none sm:hover:bg-white"
                        >
                            <HandHeart size={17} className="shrink-0 text-white transition-transform duration-300 group-hover:scale-110 sm:text-garabandal-gold" />
                            <span className="truncate sm:hidden">{locale === 'en' ? 'Prayers' : 'Intenções'}</span>
                            <span className="hidden truncate sm:inline">{locale === 'en' ? 'Prayer requests' : 'Pedidos de oração'}</span>
                        </Link>
                    </motion.div>
                </motion.div>
            </div>

            {/* Image: full-bleed background on mobile, right half on desktop */}
            <motion.div
                style={{ opacity }}
                className="absolute inset-0 lg:static lg:w-[45%] h-full z-0 lg:z-10"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:rounded-bl-[4rem] shadow-2xl"
                    style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
                />
                {/* Mobile: dark scrim concentrated at the bottom so the image stays
                    visible up top while the white text below remains readable */}
                <div className="absolute inset-0 lg:hidden bg-gradient-to-t from-garabandal-dark/90 via-garabandal-dark/45 to-garabandal-dark/10" />
            </motion.div>

            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 lg:left-[27.5%] z-20 text-garabandal-gold"
                animate={{ y: [0, 8, 0], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
                <ChevronDown size={32} strokeWidth={2.5} />
            </motion.div>
        </section>
    );
};

export default Hero;
