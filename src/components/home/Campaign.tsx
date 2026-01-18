'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CAMPAIGN_CONTENT, CASA_IMAGE_URL } from './constants';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DonationMeta, formatCurrency } from '../../lib/donations';

interface CampaignProps {
    meta: DonationMeta;
}

const Campaign: React.FC<CampaignProps> = ({ meta }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const imgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

    const progress = meta.goal <= 0 ? 0 : Math.min(100, Math.round((meta.raised / meta.goal) * 100));

    return (
        <section id="campaign" className="bg-[#0b1120] py-24 md:min-h-screen flex items-center relative overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">

                    {/* Text Content */}
                    <div className="w-full md:w-5/12 relative z-10 order-2 md:order-1">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1 }}
                        >
                            <span className="inline-block py-2 px-4 mb-8 bg-garabandal-gold/10 border border-garabandal-gold/20 rounded-full text-garabandal-gold text-[10px] font-bold tracking-[0.2em] uppercase">
                                Meta: {progress}% Atingida
                            </span>

                            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white mb-6 leading-tight">
                                {CAMPAIGN_CONTENT.title}
                            </h2>

                            <p className="text-xl text-white/80 font-serif italic mb-8">
                                {CAMPAIGN_CONTENT.subtitle}
                            </p>

                            <p className="text-white/60 font-light leading-relaxed mb-10 text-lg">
                                {CAMPAIGN_CONTENT.description}
                            </p>

                            <div className="flex justify-between items-baseline mb-3">
                                <div className="text-white">
                                    <span className="text-2xl md:text-3xl font-bold">{formatCurrency(meta.raised)}</span>
                                    <span className="ml-2 text-xs text-white/50 uppercase tracking-widest">angariados</span>
                                </div>
                                <div className="text-white/60">
                                    <span className="text-lg font-medium">{formatCurrency(meta.goal)}</span>
                                    <span className="ml-2 text-xs uppercase tracking-widest">meta</span>
                                </div>
                            </div>

                            {/* Rounded Progress Bar visual */}
                            <div className="mb-12 p-1 bg-white/5 rounded-full border border-white/5">
                                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative">
                                    <motion.div
                                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-garabandal-gold to-yellow-200 rounded-full"
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${progress}%` }}
                                        transition={{ duration: 1.5, delay: 0.5 }}
                                    />
                                </div>
                            </div>

                            <Link href="/donations" className="group bg-garabandal-gold text-white px-10 py-5 rounded-full uppercase tracking-widest text-xs font-bold hover:bg-white hover:text-garabandal-dark transition-all duration-300 shadow-[0_0_30px_-5px_rgba(212,175,55,0.4)] flex items-center gap-3 w-fit">
                                {CAMPAIGN_CONTENT.cta}
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    </div>

                    {/* Image Content */}
                    <div ref={ref} className="w-full md:w-7/12 h-[50vh] md:h-[70vh] relative order-1 md:order-2">
                        <div className="absolute inset-0 overflow-hidden rounded-[3rem] shadow-2xl border border-white/5">
                            <motion.div
                                style={{ y: imgY, scale: 1.15 }}
                                className="w-full h-full bg-cover bg-center"
                            >
                                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${CASA_IMAGE_URL})` }} />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-transparent to-transparent opacity-60" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Campaign;
