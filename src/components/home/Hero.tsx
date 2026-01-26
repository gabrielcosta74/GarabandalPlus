'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { HERO_IMAGE_URL, HERO_CONTENT, OFFICIAL_SITE_URL } from './constants';
import { ChevronDown, ArrowRight, Globe } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';

const Hero: React.FC = () => {
    const { isAuthenticated, isMember, loading } = useAuth();
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
    const textY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

    return (
        <section ref={ref} className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black">
            {/* Cinematic Background Layer */}
            <motion.div
                style={{ y, opacity }}
                className="absolute inset-0 z-0"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
                    style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
                />

                {/* Premium Dark Overlay - Disney+ Style Gradient */}
                {/* Vignette effect + bottom fade + overall darken */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                <div className="absolute inset-0 bg-black/20 z-10" />
                {/* Radial gradient to focus center */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)] z-10" />
            </motion.div>

            {/* Content Layer */}
            <div className="relative z-20 container mx-auto px-6 h-full flex flex-col justify-center items-center text-center">
                <motion.div
                    style={{ y: textY }}
                    className="max-w-5xl"
                >
                    {/* Main Title - Premium Cinematic Typography */}
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} // Custom ease for cinematic slow feel
                        className="font-serif text-6xl md:text-8xl lg:text-9xl text-white mb-8 leading-tight tracking-tight drop-shadow-2xl"
                    >
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/70">
                            {HERO_CONTENT.title}
                        </span>
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
                        className="mt-6 mb-12"
                    >
                        <p className="text-lg md:text-xl text-white/90 font-sans font-light tracking-wide max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
                            {HERO_CONTENT.subtitle}
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 1.2, ease: "easeOut" }}
                        className="flex flex-col md:flex-row gap-6 justify-center items-center"
                    >
                        {(!loading && isAuthenticated && isMember) ? (
                            <Link
                                href="/member"
                                style={{ color: '#000000' }}
                                className="relative z-50 bg-white text-black px-10 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-white/90 transition-all duration-500 min-w-[240px] flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                Ir para área de membro
                                <ArrowRight size={14} className="stroke-[3px] transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>

                        ) : (
                            <Link
                                href="/tornar-membro"
                                style={{ color: '#000000' }}
                                className="relative z-50 bg-white text-black px-10 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-white/90 transition-all duration-500 min-w-[240px] flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                {HERO_CONTENT.cta}
                                <ArrowRight size={14} className="stroke-[3px] transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        )}

                        <Link
                            href="/donations"
                            className="group px-10 py-4 rounded-md text-xs font-bold uppercase tracking-[0.2em] text-white border border-white/20 hover:bg-white/10 hover:border-white/40 transition-all duration-500 min-w-[200px] backdrop-blur-sm flex items-center justify-center"
                        >
                            Fazer Doação
                        </Link>

                        <a
                            href={OFFICIAL_SITE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group px-10 py-4 rounded-md text-xs font-bold uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all duration-500 min-w-[200px] flex items-center justify-center gap-2"
                        >
                            <Globe size={14} />
                            Site Oficial
                        </a>
                    </motion.div>
                </motion.div>
            </div>

            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-white/20"
                animate={{ y: [0, 8, 0], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
                <ChevronDown size={32} strokeWidth={1} />
            </motion.div>
        </section>
    );
};

export default Hero;
