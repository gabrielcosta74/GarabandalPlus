'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MountainSnow } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { CATEGORIES } from '../../lib/cms/categories';

/**
 * Newcomer-friendly introduction: "What is Garabandal?".
 * Light section placed right after the Hero to orient first-time visitors.
 * Intentionally brief — the full story lives on /sobre-nos to avoid duplicating
 * devotional content owned elsewhere.
 */
const WhatIsGarabandal: React.FC = () => {
    const { locale } = useLocale();
    const isEn = locale === 'en';

    // CMS "História" category landing — the canonical Garabandal history page.
    const historyHref = isEn
        ? `/en/${CATEGORIES.historia.en.slug}`
        : `/${CATEGORIES.historia.pt.slug}`;

    const facts = isEn
        ? [
            { value: '2 Jul 1961', label: 'First apparition' },
            { value: '4 girls', label: 'The visionaries' },
            { value: 'Our Lady of Carmel', label: 'The invocation' },
        ]
        : [
            { value: '2 jul 1961', label: 'Primeira aparição' },
            { value: '4 meninas', label: 'As videntes' },
            { value: 'N. Sra. do Carmo', label: 'A invocação' },
        ];

    return (
        <section className="relative bg-garabandal-mist py-24 md:py-32 overflow-hidden">
            <div className="container mx-auto px-6 lg:px-12">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Image */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: '-10%' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="relative order-last lg:order-first"
                    >
                        <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5] w-full overflow-hidden rounded-[2.5rem] shadow-2xl">
                            <Image
                                src="/images/meninasgarabandal.jpg"
                                alt={isEn ? 'The four visionaries of Garabandal' : 'As quatro videntes de Garabandal'}
                                fill
                                sizes="(max-width: 1024px) 100vw, 50vw"
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-garabandal-dark/40 via-transparent to-transparent" />
                        </div>
                        {/* Floating accent badge */}
                        <div className="absolute -bottom-6 -right-2 sm:right-6 bg-white rounded-2xl shadow-xl px-6 py-4 border border-slate-100">
                            <p className="font-serif text-3xl text-garabandal-dark leading-none">1961</p>
                            <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">
                                {isEn ? 'Cantabria, Spain' : 'Cantábria, Espanha'}
                            </p>
                        </div>
                    </motion.div>

                    {/* Content */}
                    <div>
                        <motion.span
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-garabandal-gold/10 border border-garabandal-gold/30 text-[11px] font-bold uppercase tracking-[0.2em] text-garabandal-dark/70 mb-7"
                        >
                            <MountainSnow className="w-3.5 h-3.5 text-garabandal-gold" />
                            {isEn ? 'The Apparition · 1961' : 'A Aparição · 1961'}
                        </motion.span>

                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.05 }}
                            className="font-serif text-4xl md:text-5xl lg:text-6xl text-garabandal-dark leading-[1.1] mb-8"
                        >
                            {isEn ? 'What is Garabandal?' : 'O que é Garabandal?'}
                        </motion.h2>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="space-y-5 text-lg text-slate-600 font-light leading-relaxed max-w-xl"
                        >
                            <p>
                                {isEn
                                    ? 'On 2 July 1961, in the small village of San Sebastián de Garabandal, in the mountains of northern Spain, Our Lady of Mount Carmel appeared to four girls aged 11 and 12.'
                                    : 'A 2 de julho de 1961, na pequena aldeia de San Sebastián de Garabandal, nas montanhas do norte de Espanha, Nossa Senhora do Carmo apareceu a quatro meninas de 11 e 12 anos.'}
                            </p>
                            <p>
                                {isEn
                                    ? 'For over four years, hundreds of apparitions, ecstasies and messages of prayer, penance and love for the Eucharist followed — a hidden treasure in the mountain that today asks to be revealed to the world.'
                                    : 'Durante mais de quatro anos sucederam-se centenas de aparições, êxtases e mensagens de oração, penitência e amor à Eucaristia — um tesouro escondido na montanha que hoje pede para ser revelado ao mundo.'}
                            </p>
                        </motion.div>

                        {/* Fact chips */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.15 }}
                            className="grid grid-cols-3 gap-4 mt-10 max-w-xl"
                        >
                            {facts.map((f) => (
                                <div key={f.label} className="rounded-2xl bg-white border border-slate-100 px-4 py-5 text-center shadow-sm">
                                    <p className="font-serif text-lg md:text-xl text-garabandal-dark leading-tight">{f.value}</p>
                                    <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 mt-2">{f.label}</p>
                                </div>
                            ))}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="mt-10"
                        >
                            <Link
                                href={historyHref}
                                className="group inline-flex items-center gap-3 bg-garabandal-gold text-garabandal-dark px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider hover:-translate-y-1 hover:brightness-105 transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(212,175,55,0.5)] hover:shadow-[0_12px_25px_-6px_rgba(212,175,55,0.6)]"
                            >
                                <span>{isEn ? 'Discover the story' : 'Conhecer a história'}</span>
                                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default WhatIsGarabandal;
