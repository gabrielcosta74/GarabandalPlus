"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCurrency } from "../providers/CurrencyProvider";
import { getMembershipAmountClient } from "../../lib/membership-pricing";
import { useLocale } from "../../contexts/LocaleContext";

type Props = {
    onJoinClick?: () => void;
};

export default function MembershipHero({ onJoinClick }: Props) {
    const { formatPrice } = useCurrency();
    const { t } = useLocale();
    const m = t.membership;
    const membershipAmount = getMembershipAmountClient();

    return (
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-900 py-20">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('/images/pattern-noise.png')] opacity-10 mix-blend-overlay" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[#d97706]/20 blur-[120px] rounded-full pointer-events-none" />

            {/* Floating Orbs */}
            <motion.div
                animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-10 w-32 h-32 bg-[#fbbf24]/10 rounded-full blur-2xl"
            />

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16">

                    {/* LEFT CONTENT */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1 }}
                        className="flex-1 text-center lg:text-left"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d97706]/10 border border-[#d97706]/20 backdrop-blur-md mb-8"
                        >
                            <span className="w-2 h-2 rounded-full bg-[#d97706] animate-pulse" />
                            <span className="text-[#d97706] text-xs font-bold uppercase tracking-widest">{m.hero.badge}</span>
                        </motion.div>

                        <h1 className="font-serif text-5xl md:text-7xl text-white leading-tight mb-8 drop-shadow-2xl">
                            {m.hero.title} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fbbf24] to-[#d97706]">
                                {m.hero.titleHighlight}
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-300 font-light leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
                            {m.hero.subtitle}
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start">
                            <button
                                onClick={onJoinClick}
                                className="group relative px-8 py-5 bg-[#d97706] text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-[#b45309] transition-all shadow-[0_0_30px_-5px_rgba(217,119,6,0.5)] hover:shadow-[0_0_50px_-10px_rgba(217,119,6,0.7)] hover:scale-105 active:scale-95"
                            >
                                <span className="flex items-center gap-3">
                                    {m.hero.cta}
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>

                            <div className="text-left">
                                <div className="text-2xl font-serif text-white">{formatPrice(membershipAmount)}<span className="text-sm text-slate-400">{m.hero.perYear}</span></div>
                                <div className="text-xs text-[#d97706] font-bold uppercase tracking-wider">{m.hero.immediateAccess}</div>
                            </div>
                        </div>
                    </motion.div>

                    {/* RIGHT VISUAL - Single Holy Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="flex-1 relative max-w-md w-full"
                    >
                        {/* Glow Behind */}
                        <div className="absolute inset-0 bg-[#d97706] blur-[100px] opacity-20" />

                        {/* Main Image Card */}
                        <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                            <img
                                src="/images/associacao.webp"
                                alt={m.hero.imageLabel}
                                className="w-full h-full object-cover transform transition-transform duration-[3s] group-hover:scale-110"
                            />

                            {/* Overlay Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-8 z-20 text-center">
                                <p className="text-xs text-white/60 uppercase tracking-widest font-bold">{m.hero.imageLabel}</p>
                            </div>

                            {/* Border Glow */}
                            <div className="absolute inset-0 rounded-[2rem] border border-white/10 shadow-[inset_0_0_40px_rgba(255,255,255,0.1)] pointer-events-none" />
                        </div>

                        {/* Floating Small Elements */}


                    </motion.div>
                </div>
            </div>
        </section>
    );
}
