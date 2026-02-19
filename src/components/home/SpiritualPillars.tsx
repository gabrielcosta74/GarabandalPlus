"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Flame, Users, ArrowUpRight, Heart, Sparkles, MessageCircle } from 'lucide-react';

const SpiritualPillars = () => {
    return (
        <section className="py-24 md:py-32 bg-[#050b14] relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 min-h-[600px]">

                    {/* Prayer Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="group relative rounded-[2.5rem] overflow-hidden border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm"
                    >
                        {/* Background Image with Parallax Effect */}
                        <div className="absolute inset-0 z-0">
                            <motion.div
                                className="absolute inset-0 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-40 group-hover:opacity-50 transition-opacity duration-700"
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 1.5 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050b14] via-[#050b14]/60 to-transparent" />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 p-10 h-full flex flex-col items-center justify-between text-center">

                            {/* Floating Icon */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 backdrop-blur-md"
                            >
                                <Flame className="w-8 h-8 text-amber-500" />
                            </motion.div>

                            <div className="space-y-6 max-w-md mx-auto">
                                <h3 className="font-serif text-4xl md:text-5xl text-white">
                                    Rede de <span className="text-amber-400 italic">Oração</span>
                                </h3>
                                <p className="text-slate-300 font-light leading-relaxed">
                                    A força do Apostolado reside na união dos corações. Envie as suas intenções e junte-se a esta corrente mundial de intercessão pelo Imaculado Coração.
                                </p>
                            </div>

                            <Link href="/intencoes" className="mt-12 group/btn">
                                <button className="cursor-pointer relative px-8 py-4 bg-transparent border border-amber-500/30 text-amber-100 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-amber-500 hover:text-white hover:border-transparent transition-all duration-300 group-hover/btn:shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                                    <MessageCircle className="w-4 h-4" />
                                    Enviar Intenção
                                    <ArrowUpRight className="w-4 h-4" />
                                </button>
                            </Link>
                        </div>
                    </motion.div>

                    {/* Community Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="group relative rounded-[2.5rem] overflow-hidden border border-white/5 bg-gradient-to-bl from-slate-900/80 to-slate-900/40 backdrop-blur-sm"
                    >
                        {/* Background Image with Parallax Effect */}
                        <div className="absolute inset-0 z-0">
                            <motion.div
                                className="absolute inset-0 bg-[url('/images/associacao.webp')] bg-cover bg-center opacity-40 group-hover:opacity-50 transition-opacity duration-700"
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 1.5 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050b14] via-[#050b14]/60 to-transparent" />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 p-10 h-full flex flex-col items-center justify-between text-center">

                            {/* Floating Icon */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-8 backdrop-blur-md"
                            >
                                <Users className="w-8 h-8 text-blue-400" />
                            </motion.div>

                            <div className="space-y-6 max-w-md mx-auto">
                                <h3 className="font-serif text-4xl md:text-5xl text-white">
                                    Membros do <span className="text-blue-400 italic">Apostolado</span>
                                </h3>
                                <p className="text-slate-300 font-light leading-relaxed">
                                    Não caminhe sozinho. Torne-se membro desta família espiritual, tenha acesso a conteúdos exclusivos e ajude a sustentar a missão de levar a Mensagem ao mundo.
                                </p>
                            </div>

                            <Link href="/tornar-membro" className="mt-12 group/btn">
                                <button className="cursor-pointer relative px-8 py-4 bg-white text-slate-900 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-blue-50 transition-all duration-300 shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95">
                                    <Sparkles className="w-4 h-4 text-blue-600" />
                                    Ser Membro Oficial
                                    <ArrowUpRight className="w-4 h-4" />
                                </button>
                            </Link>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
};

export default SpiritualPillars;
