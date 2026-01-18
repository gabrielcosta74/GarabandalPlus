'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, CreditCard, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { SHOP_IMAGE_URL, MEMBER_IMAGE_URL } from './constants';
import Link from 'next/link';
import NonMemberOnly from '../../components/site/NonMemberOnly';

const Sustain: React.FC = () => {
    return (
        <section id="sustain" className="py-32 bg-garabandal-dark relative">
            <div className="container mx-auto px-6">

                {/* Section Header */}
                <div className="text-center mb-20">
                    <h2 className="font-serif text-4xl md:text-5xl text-white mb-6">Área de Apoio</h2>
                    <p className="text-white/50 max-w-2xl mx-auto font-light">
                        Utilize as funcionalidades da app para gerir a sua subscrição, encomendar artigos ou fazer doações pontuais.
                    </p>
                </div>

                {/* Bento Grid Layout - Rounded */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[650px]">

                    {/* Membership Card - Large Left */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="md:col-span-7 relative group overflow-hidden rounded-[3rem] bg-[#111] border border-white/10 flex flex-col justify-end p-10 md:p-14"
                    >
                        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-50"
                            style={{ backgroundImage: `url(${MEMBER_IMAGE_URL})` }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

                        <div className="relative z-10">
                            <div className="bg-[#d4af37] w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg">
                                <CreditCard size={28} />
                            </div>
                            <h3 className="font-serif text-4xl text-white mb-4">Ser Membro</h3>
                            <p className="text-white/90 mb-8 font-light max-w-md text-lg">
                                Garanta a continuidade deste apostolado. Acesso a conteúdos exclusivos na app.
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <NonMemberOnly>
                                    <Link href="/tornar-membro" className="bg-white text-black hover:bg-gray-200 hover:text-black px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-3 w-fit shadow-lg">
                                        Subscrever Agora
                                        <ArrowUpRight size={16} />
                                    </Link>
                                </NonMemberOnly>
                                <Link href="/member" className="bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-black border border-white/20 px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all w-fit">
                                    Área de Membro
                                </Link>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column Stack */}
                    <div className="md:col-span-5 flex flex-col gap-6">

                        {/* Shop Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="flex-1 relative group overflow-hidden rounded-[3rem] bg-white/5 border border-white/10 p-10 flex flex-col justify-center items-start"
                        >
                            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-30 group-hover:opacity-50"
                                style={{ backgroundImage: `url(${SHOP_IMAGE_URL})` }} />
                            <div className="absolute inset-0 bg-black/60" />

                            <div className="relative z-10 w-full">
                                <div className="flex justify-between items-start w-full mb-6">
                                    <ShoppingBag className="text-garabandal-gold" size={32} />
                                    <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-white/60 text-[10px] uppercase tracking-widest font-bold">Loja App</span>
                                </div>
                                <h3 className="font-serif text-3xl text-white mb-2">Loja Online</h3>
                                <p className="text-white/60 text-sm font-light mb-8">
                                    Adquira terços, livros e imagens oficiais.
                                </p>
                                <Link href="/loja-online" className="w-full block text-center bg-white/10 hover:bg-white hover:text-black text-white py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all backdrop-blur-md border border-white/10">
                                    Aceder à Loja
                                </Link>
                            </div>
                        </motion.div>

                        {/* Donation Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="flex-1 rounded-[3rem] bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/5 p-10 flex flex-col justify-center relative overflow-hidden group"
                        >
                            {/* Decorative light beam */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-garabandal-gold/20 blur-[50px] rounded-full group-hover:bg-garabandal-gold/30 transition-all duration-700" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <Heart className="text-garabandal-gold fill-garabandal-gold/20" size={32} />
                                    <div className="flex items-center gap-2 text-green-400/80 text-[10px] uppercase tracking-wider font-bold bg-green-900/20 px-3 py-1 rounded-full border border-green-900/30">
                                        <ShieldCheck size={12} />
                                        <span>Seguro</span>
                                    </div>
                                </div>
                                <h3 className="font-serif text-2xl text-white mb-4">Doação Rápida</h3>
                                <p className="text-white/50 text-sm font-light mb-8">
                                    Apoie a missão com um clique.
                                </p>
                                <Link href="/donations" className="w-full block text-center bg-garabandal-gold text-white py-4 rounded-full uppercase tracking-widest text-xs font-bold hover:bg-white hover:text-black transition-colors shadow-lg shadow-garabandal-gold/10">
                                    Doar Agora
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Sustain;
