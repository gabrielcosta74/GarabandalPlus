"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, ArrowUpRight, ShieldCheck, Sparkles, CreditCard, Star } from 'lucide-react';
import Link from 'next/link';
import { SHOP_IMAGE_URL, MEMBER_IMAGE_URL } from './constants';

const PANELS = [
    {
        id: 'member',
        title: 'Ser Membro',
        subtitle: 'Família Garabandal',
        description: 'Junte-se a nós nesta missão de amor. O seu apoio mensal sustenta toda a obra de evangelização.',
        icon: Star,
        image: MEMBER_IMAGE_URL,
        cta: 'Tornar-me Membro',
        href: '/tornar-membro',
        color: 'from-amber-500 to-yellow-600',
        textColor: 'text-amber-400'
    },
    {
        id: 'shop',
        title: 'Loja Oficial',
        subtitle: 'Artigos de Devoção',
        description: 'Adquira terços, livros e imagens que elevam a alma. Cada compra reverte para o Apostolado.',
        icon: ShoppingBag,
        image: SHOP_IMAGE_URL,
        cta: 'Visitar Loja',
        href: '/loja-online',
        color: 'from-blue-500 to-indigo-600',
        textColor: 'text-blue-400'
    },
    {
        id: 'donate',
        title: 'Fazer Doação',
        subtitle: 'Ajuda Pontual',
        description: 'Contribua livremente para a construção da Casa do Apostolado e manutenção do Santuário.',
        icon: Heart,
        image: '/images/igrejagarabandal.webp',
        cta: 'Fazer Donativo',
        href: '/donations',
        color: 'from-rose-500 to-red-600',
        textColor: 'text-rose-400'
    }
];

export default function SupportArea() {
    // Default to middle panel expanded on desktop, or none? Let's default to 'member' (first)
    const [activePanel, setActivePanel] = useState<string | null>('member');

    return (
        <section className="py-24 md:py-32 bg-[#050b14] relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,0.7),#050b14)] pointer-events-none" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                {/* Section Header */}
                <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-slate-400 mb-6"
                    >
                        <ShieldCheck className="w-3 h-3" />
                        Área de Apoio
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="font-serif text-4xl md:text-5xl lg:text-6xl text-white mb-6 leading-tight"
                    >
                        Sustente a <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">Missão</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 text-lg font-light leading-relaxed"
                    >
                        Escolha como quer apoiar o Apostolado de Garabandal.
                        Cada gesto seu é uma pedra viva na construção desta obra.
                    </motion.p>
                </div>

                {/* Interactive Panels */}
                <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[600px]">
                    {PANELS.map((panel) => {
                        const isActive = activePanel === panel.id;

                        return (
                            <motion.div
                                key={panel.id}
                                layout
                                layoutId={`panel-${panel.id}`}
                                transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
                                onHoverStart={() => setActivePanel(panel.id)}
                                onClick={() => setActivePanel(panel.id)} // For mobile tap
                                className={`
                                    relative overflow-hidden rounded-[2rem] border border-white/10 cursor-pointer group
                                    ${isActive ? 'lg:flex-[3]' : 'lg:flex-[1]'}
                                    transition-all duration-500 ease-in-out
                                    h-[400px] lg:h-auto flex flex-col justify-end
                                `}
                            >
                                {/* Background Image */}
                                <div className="absolute inset-0 z-0">
                                    <motion.div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
                                        style={{ backgroundImage: `url(${panel.image})` }}
                                        animate={{ scale: isActive ? 1.05 : 1 }}
                                    />
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90 transition-opacity duration-500 ${isActive ? 'opacity-80' : 'opacity-60 lg:opacity-80'}`} />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
                                </div>

                                {/* Content */}
                                <div className="relative z-10 p-8 md:p-10 flex flex-col h-full justify-end">

                                    {/* Icon - Top positioned when inactive, or refined when active */}
                                    <div className={`
                                        mb-auto transition-all duration-500
                                        ${isActive ? 'opacity-100 translate-y-0' : 'opacity-100 lg:opacity-70'}
                                    `}>
                                        <div className={`
                                            w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg
                                            bg-gradient-to-br ${panel.color}
                                        `}>
                                            <panel.icon size={26} />
                                        </div>
                                    </div>

                                    {/* Text Content */}
                                    <div className="space-y-4">
                                        <motion.div layout transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}>
                                            <span className={`text-xs font-bold uppercase tracking-widest ${panel.textColor} mb-2 block`}>
                                                {panel.subtitle}
                                            </span>
                                            <h3 className="text-3xl md:text-4xl font-serif text-white leading-none">
                                                {panel.title}
                                            </h3>
                                        </motion.div>

                                        <AnimatePresence>
                                            {isActive && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                                    className="origin-bottom overflow-hidden"
                                                >
                                                    <p className="text-slate-300 font-light leading-relaxed mb-8 max-w-lg">
                                                        {panel.description}
                                                    </p>

                                                    <Link href={panel.href} className="inline-block mt-auto">
                                                        <button className="cursor-pointer bg-white text-slate-900 px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-xl shadow-black/20">
                                                            {panel.cta}
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        </button>
                                                    </Link>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Mobile/Compact View Prompt (Arrow) */}
                                        {!isActive && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="hidden lg:block pt-4 text-white/50"
                                            >
                                                <ArrowUpRight className="w-6 h-6 rotate-45" />
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
