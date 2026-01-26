'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PILLARS_CONTENT } from './constants';
import { Users, Flame, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import NonMemberOnly from '../../components/site/NonMemberOnly';

const icons = [Flame, Users];

const Pillars: React.FC = () => {
    return (
        <section id="pillars" className="py-24 bg-garabandal-dark relative overflow-hidden">
            <div className="container mx-auto px-6 relative z-10">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                    {PILLARS_CONTENT.map((pillar, index) => {
                        const Icon = icons[index];
                        const isMain = index === 1; // Highlight the second one (Community)
                        // @ts-ignore
                        const hasBg = !!pillar.backgroundImage;

                        // Use dark text only if it's the main card AND has no background image
                        const useDarkText = isMain && !hasBg;

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.2, duration: 0.6 }}
                                viewport={{ once: true }}
                                className={`
                                    relative overflow-hidden rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[400px] group
                                    ${isMain ? 'bg-[#d4af37]' : 'bg-[#1a1a1a]'}
                                `}
                            >
                                {/* Background Image if present */}
                                {hasBg && (
                                    <>
                                        <div
                                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                            // @ts-ignore
                                            style={{ backgroundImage: `url(${pillar.backgroundImage})` }}
                                        />
                                        <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors duration-500" />
                                    </>
                                )}

                                {/* Content Top */}
                                <div className="relative z-10">
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-xl shadow-lg
                                        ${useDarkText ? 'bg-black/20 text-black' : 'bg-white/10 text-white backdrop-blur-md'}
                                    `}>
                                        <Icon size={24} />
                                    </div>

                                    <h3 className={`font-serif text-3xl mb-4 drop-shadow-md ${useDarkText ? 'text-black' : 'text-white'}`}>
                                        {pillar.title}
                                    </h3>

                                    <p className={`text-lg leading-relaxed font-light drop-shadow-md ${useDarkText ? 'text-black/80' : 'text-white/80'}`}>
                                        {pillar.description}
                                    </p>
                                </div>

                                {/* Action Bottom */}
                                <div className="mt-8 relative z-10">
                                    <Link
                                        href={pillar.link || '#'}
                                        className={`
                                            w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95
                                            ${isMain
                                                ? 'bg-black text-white shadow-lg shadow-black/20 hover:scale-[1.03]'
                                                : 'bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white hover:text-black shadow-lg'
                                            }
                                        `}
                                    >
                                        {pillar.action}
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default Pillars;
