"use client";

import { motion } from "framer-motion";

interface MembershipImpactProps {
    stats: {
        members: number;
        raised: number;
        goal: number;
    };
}

export default function MembershipImpact({ stats }: MembershipImpactProps) {
    const progress = Math.min(100, Math.max(0, (stats.raised / stats.goal) * 100));

    return (
        <section className="py-24 bg-garabandal-dark text-white overflow-hidden relative">

            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-garabandal-gold/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

                    <div>
                        <h2 className="font-serif text-4xl md:text-5xl mb-8 leading-tight">
                            O teu impacto é <br /><span className="text-garabandal-gold">real e imediato.</span>
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed mb-12 font-light max-w-lg">
                            Cada quota de membro não é apenas um número. É combustível para manter a chama de Garabandal acesa através de encontros, livros e acolhimento.
                        </p>

                        <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
                            <div>
                                <div className="text-4xl md:text-5xl font-serif text-white mb-2">
                                    {stats.members}
                                </div>
                                <div className="text-xs font-bold uppercase tracking-widest text-garabandal-gold">Membros ativos</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Meta Anual de Angariação</div>
                                <div className="text-3xl font-serif">€{stats.raised.toLocaleString()} <span className="text-lg text-gray-500">/ €{stats.goal.toLocaleString()}</span></div>
                            </div>
                            <div className="text-4xl font-bold text-garabandal-gold">{progress.toFixed(0)}%</div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-4 bg-white/10 rounded-full overflow-hidden w-full mb-6">
                            <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: `${progress}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-garabandal-gold relative"
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            </motion.div>
                        </div>

                        <p className="text-sm text-gray-400 leading-relaxed">
                            Este valor destina-se a cobrir as despesas fixas da associação, incluindo a manutenção da sede, produção de conteúdos e apoio logístico aos peregrinos, sem fins lucrativos.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
