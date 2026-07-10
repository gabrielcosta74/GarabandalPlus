'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { CATEGORIES } from '../../lib/cms/categories';

/**
 * Newcomer-friendly introduction: "What is Garabandal?".
 * Minimalist editorial design, focusing on typography and clean imagery.
 */
const WhatIsGarabandal: React.FC = () => {
    const { locale } = useLocale();
    const isEn = locale === 'en';

    const historyHref = isEn
        ? `/en/${CATEGORIES.historia.en.slug}`
        : `/${CATEGORIES.historia.pt.slug}`;

    return (
        <section className="relative bg-garabandal-mist py-20 md:py-32 overflow-hidden">
            <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
                <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

                    {/* Image */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-10%' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="relative order-last lg:order-first"
                    >
                        <div className="relative aspect-[4/5] sm:aspect-square lg:aspect-[4/5] w-full overflow-hidden rounded-2xl md:rounded-[2rem]">
                            <Image
                                src="/images/meninasgarabandal.jpg"
                                alt={isEn ? 'The four visionaries of Garabandal' : 'As quatro videntes de Garabandal'}
                                fill
                                sizes="(max-width: 1024px) 100vw, 50vw"
                                className="object-cover"
                            />
                        </div>
                    </motion.div>

                    {/* Content */}
                    <div className="max-w-xl">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="font-serif text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.15] mb-8 tracking-tight"
                        >
                            {isEn ? 'What is Garabandal?' : 'O que é Garabandal?'}
                        </motion.h2>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="space-y-6 text-lg md:text-xl text-slate-600 font-normal leading-relaxed"
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

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="mt-12"
                        >
                            <Link
                                href={historyHref}
                                className="group inline-flex items-center gap-2 text-slate-900 font-bold uppercase tracking-wider text-sm hover:text-slate-600 transition-colors"
                            >
                                <span className="border-b-2 border-transparent group-hover:border-slate-600 transition-colors pb-1">
                                    {isEn ? 'Discover the story' : 'Conhecer a história'}
                                </span>
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
