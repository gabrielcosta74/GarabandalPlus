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
        <section className="relative bg-[#050b14] py-24 md:py-32 overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
                    <motion.span
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-amber-300/80 mb-6"
                    >
                        {isEn ? 'Recognition' : 'Reconhecimento'}
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.05 }}
                        className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-6"
                    >
                        {isEn ? (
                            <>What the saints said about <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">Garabandal</span></>
                        ) : (
                            <>O que disseram sobre <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">Garabandal</span></>
                        )}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 text-lg font-light leading-relaxed"
                    >
                        {isEn
                            ? 'Popes, saints and witnesses of faith who recognised the events of the mountain.'
                            : 'Papas, santos e testemunhas da fé que reconheceram os acontecimentos da montanha.'}
                    </motion.p>
                </div>

                {/* Quote cards */}
                <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                    {ENDORSEMENTS.map((e, i) => (
                        <motion.figure
                            key={e.author}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.12 }}
                            className="group relative flex flex-col rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8 md:p-10 backdrop-blur-sm hover:border-amber-500/30 transition-colors duration-500"
                        >
                            <Quote className="w-10 h-10 text-amber-500/40 mb-6 fill-amber-500/10" />
                            <blockquote className="font-serif text-xl md:text-2xl text-white italic leading-relaxed flex-1">
                                {isEn ? e.quoteEn : e.quotePt}
                            </blockquote>
                            <figcaption className="mt-8 pt-6 border-t border-white/10">
                                <p className="text-amber-200 font-semibold">{e.author}</p>
                                <p className="text-sm text-slate-400 font-light mt-1">{isEn ? e.roleEn : e.rolePt}</p>
                            </figcaption>
                        </motion.figure>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Endorsements;
