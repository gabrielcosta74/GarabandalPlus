'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, History } from 'lucide-react';
import Image from 'next/image';
import { useLocale } from '../../contexts/LocaleContext';

const AboutTeaser: React.FC = () => {
    const { t } = useLocale();
    const a = t.membership.about;
    const aboutUrl = t.urls.about;
    return (
        <section className="relative py-24 overflow-hidden bg-slate-50">
            {/* Background elements */}
            <div className="absolute inset-0 z-0 bg-slate-50" />

            {/* Elegant Pattern / Motif in the background */}
            <div className="absolute top-0 right-0 w-1/2 h-full z-0 opacity-[0.03] transform translate-x-1/4">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M50 0 L100 50 L50 100 L0 50 Z" fill="currentColor" />
                </svg>
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Text block */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <span className="h-px w-8 bg-garabandal-gold" />
                            <span className="text-sm font-bold tracking-[0.2em] text-garabandal-gold uppercase">{a.eyebrow}</span>
                        </div>

                        <h2 className="text-3xl md:text-5xl font-serif font-bold text-garabandal-dark mb-6 leading-tight">
                            {a.titleLead} <span className="text-garabandal-gold italic">{a.titleYears}</span> {a.titleTrail}
                        </h2>

                        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                            {a.paragraph}
                        </p>

                        <ul className="space-y-4 mb-10">
                            {a.bullets.map((item, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: 0.2 + (i * 0.1) }}
                                    className="flex items-center gap-3 text-slate-700 font-medium"
                                >
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-garabandal-gold/10 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-garabandal-gold" />
                                    </div>
                                    {item}
                                </motion.li>
                            ))}
                        </ul>

                        <Link
                            href={aboutUrl}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-garabandal-dark !text-white !opacity-100 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 group"
                        >
                            {a.cta}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>

                    {/* Visual block */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        className="relative"
                    >
                        {/* Decorative background framing */}
                        <div className="absolute inset-0 bg-garabandal-gold/10 rounded-3xl transform rotate-3 scale-105 -z-10" />
                        <div className="absolute inset-0 bg-garabandal-dark rounded-3xl transform -rotate-2 scale-100 -z-10" />

                        <div className="relative aspect-[4/5] md:aspect-square rounded-2xl overflow-hidden shadow-2xl">
                            <Image
                                src="/images/nossasenhoragarabandal.jpg"
                                alt={a.imageAlt}
                                fill
                                className="object-cover transform hover:scale-105 transition-transform duration-700 ease-in-out"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                            <div className="absolute bottom-0 left-0 p-8 w-full backdrop-blur-sm bg-black/20 text-white">
                                <History className="w-8 h-8 text-garabandal-gold mb-3" />
                                <h3 className="font-serif text-2xl font-bold mb-2">{a.cardTitle}</h3>
                                <p className="text-sm text-white/80 line-clamp-2">{a.cardDesc}</p>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
};

export default AboutTeaser;
