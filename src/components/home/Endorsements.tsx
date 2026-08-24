'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

/**
 * Renowned endorsements of Garabandal (social proof / credibility band).
 *
 * ⚠️ REVER ANTES DE PUBLICAR: estas são versões documentadas das citações.
 * Confirmar o texto e a atribuição exatos com a equipa do Apostolado.
 * Em particular, a frase atribuída à Madre Teresa é, em muitas fontes,
 * atribuída a Conchita González (uma das videntes) — verificar antes do go-live.
 */

interface Endorsement {
    quotePt: string;
    quoteEn: string;
    author: string;
    rolePt: string;
    roleEn: string;
}

const ENDORSEMENTS: Endorsement[] = [
    {
        quotePt: 'É a história mais bela da Humanidade depois do nascimento de Jesus Cristo.',
        quoteEn: 'It is the most beautiful story of Humanity since the birth of Jesus Christ.',
        author: 'Papa Paulo VI',
        rolePt: 'Sumo Pontífice',
        roleEn: 'Supreme Pontiff',
    },
    {
        quotePt: 'Sim, é verdade que Nossa Senhora está a aparecer em Garabandal.',
        quoteEn: 'Yes, it is true that Our Lady is appearing at Garabandal.',
        author: 'São Padre Pio',
        rolePt: 'Místico e confessor',
        roleEn: 'Mystic and confessor',
    },
    {
        quotePt: 'Desde o início senti que os acontecimentos de Garabandal eram verdadeiros.',
        quoteEn: 'From the very beginning I felt that the events of Garabandal were true.',
        author: 'Madre Teresa de Calcutá',
        rolePt: 'Fundadora das Missionárias da Caridade',
        roleEn: 'Founder of the Missionaries of Charity',
    },
];

const Endorsements: React.FC = () => {
    const { locale } = useLocale();
    const isEn = locale === 'en';

    return (
        <section className="bg-white py-24 md:py-32">
            <div className="container mx-auto max-w-7xl px-6">
                {/* Header */}
                <div className="mb-14 max-w-3xl md:mb-16">
                    <motion.span
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700"
                    >
                        {isEn ? 'Recognition' : 'Reconhecimento'}
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.05 }}
                        className="mb-5 font-serif text-4xl leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl"
                    >
                        {isEn ? (
                            <>What they said about <span className="italic text-yellow-500">Garabandal</span></>
                        ) : (
                            <>O que disseram sobre <span className="italic text-yellow-500">Garabandal</span></>
                        )}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="max-w-2xl text-lg leading-relaxed text-slate-600"
                    >
                        {isEn
                            ? 'Popes, saints and witnesses of faith who recognised the events of the mountain.'
                            : 'Papas, santos e testemunhas da fé que reconheceram os acontecimentos da montanha.'}
                    </motion.p>
                </div>

                {/* Quote cards */}
                <div className="grid gap-5 md:grid-cols-3 md:gap-6">
                    {ENDORSEMENTS.map((e, i) => (
                        <motion.figure
                            key={e.author}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.12 }}
                            className="group flex min-h-[22rem] flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8"
                        >
                            <Quote className="mb-6 h-9 w-9 fill-amber-100 text-amber-600" aria-hidden />
                            <blockquote className="flex-1 font-serif text-xl leading-relaxed text-slate-800 md:text-[1.35rem]">
                                {isEn ? e.quoteEn : e.quotePt}
                            </blockquote>
                            <figcaption className="mt-8 border-t border-slate-100 pt-5">
                                <p className="font-semibold text-slate-900">{e.author}</p>
                                <p className="mt-1 text-sm text-slate-500">{isEn ? e.roleEn : e.rolePt}</p>
                            </figcaption>
                        </motion.figure>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Endorsements;
