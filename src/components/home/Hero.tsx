'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { HERO_IMAGE_URL, HERO_CONTENT } from './constants';
import { ChevronDown, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const Hero: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const textY = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

    return (
        <section ref={ref} className="relative h-[100vh] w-full overflow-hidden flex items-center justify-center">
            {/* Cinematic Background */}
            <motion.div
                style={{ y, opacity }}
                className="absolute inset-0 z-0"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110"
                    style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-garabandal-dark z-10" />
            </motion.div>

            {/* Content */}
            <div className="relative z-20 container mx-auto px-6 h-full flex flex-col justify-center items-center text-center pt-20">
                <motion.div
                    style={{ y: textY }}
                    className="max-w-4xl"
                >
                    {/* Spiritual Quote Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="mb-8 flex justify-center"
                    >
                        <div className="flex items-center space-x-2 text-garabandal-gold/90 bg-white/10 backdrop-blur-xl px-6 py-2 rounded-full border border-white/10 shadow-lg">
                            <Star size={12} fill="currentColor" />
                            <span className="text-[10px] uppercase tracking-[0.25em] font-bold">App Oficial do Apostolado</span>
                            <Star size={12} fill="currentColor" />
                        </div>
                    </motion.div>

                    {/* Main Title Area */}
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.8 }}
                        className="font-serif text-5xl md:text-7xl lg:text-8xl text-white mb-6 leading-tight tracking-tight drop-shadow-2xl"
                    >
                        {HERO_CONTENT.title}
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 1.5 }}
                        className="mt-6 mb-10"
                    >
                        <p className="text-base md:text-lg text-white/80 font-sans font-light tracking-wide max-w-xl mx-auto leading-relaxed">
                            {HERO_CONTENT.subtitle}
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 2 }}
                        className="flex flex-col md:flex-row gap-4 justify-center items-center"
                    >
                        <button
                            onClick={() => document.getElementById('sustain')?.scrollIntoView({ behavior: 'smooth' })}
                            className="group bg-white text-garabandal-dark px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-garabandal-gold hover:text-white transition-all duration-300 min-w-[220px] shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
                        >
                            {HERO_CONTENT.cta}
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <Link
                            href="/donations"
                            className="px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest text-white border border-white/30 hover:bg-white/10 hover:border-white hover:text-white transition-all duration-300 min-w-[220px] backdrop-blur-sm flex items-center justify-center"
                        >
                            Fazer Doação
                        </Link>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 2.5 }}
                        className="mt-8"
                    >
                        <a
                            href="https://apostoladodegarabandal.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-white/50 hover:text-white uppercase tracking-widest transition-colors border-b border-transparent hover:border-white pb-1"
                        >
                            Ir para site oficial
                        </a>
                    </motion.div>
                </motion.div>
            </div>

            <motion.div
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-white/30"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                <ChevronDown size={24} />
            </motion.div>
        </section>
    );
};

export default Hero;
