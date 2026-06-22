"use client";

import { BookOpen, Users, GraduationCap, ArrowRight, Church, Mic2, Ticket, ScrollText, Sparkles } from "lucide-react";
import { useLocale } from "../../contexts/LocaleContext";

export default function MembershipBenefits() {
    const { t } = useLocale();
    const b = t.membership.benefits;
    return (
        <section className="py-24 bg-slate-50 relative overflow-hidden">
            <div className="container mx-auto px-6">

                <div className="max-w-3xl mx-auto text-center mb-20">
                    <span className="text-[#d97706] text-xs font-bold uppercase tracking-widest mb-4 block">{b.eyebrow}</span>
                    <h2 className="font-serif text-4xl md:text-5xl text-slate-900 mb-6">{b.heading}</h2>
                    <p className="text-gray-500 text-lg font-light leading-relaxed">
                        {b.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* --- FEATURED: PRIVATE DOCUMENTATION (Golden) --- */}
                    <div className="lg:col-span-12 relative group rounded-[2.5rem] overflow-hidden shadow-2xl min-h-[340px] flex flex-col justify-center p-10 lg:p-14 bg-gradient-to-br from-[#1a1407] via-[#2a1f0a] to-black ring-1 ring-amber-500/30">
                        <div className="absolute inset-0 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl" />

                        <div className="relative z-10 max-w-2xl">
                            <span className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-widest">
                                <Sparkles size={14} /> {b.archiveBadge}
                            </span>
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-6 text-black shadow-lg shadow-amber-500/30">
                                <ScrollText size={32} />
                            </div>
                            <h3 className="text-3xl md:text-4xl font-serif text-white mb-4">
                                <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">{b.archive}</span>
                            </h3>
                            <p className="text-gray-200 text-lg leading-relaxed mb-6">
                                {b.archiveDesc}
                            </p>
                            <div className="flex items-center gap-2 text-amber-300 text-sm font-bold uppercase tracking-widest group-hover:text-amber-200 transition-colors">
                                {b.archiveLink} <ArrowRight size={14} />
                            </div>
                        </div>
                    </div>

                    {/* --- ROW 1 (High Priority Multimedia & Books) --- */}

                    {/* VIDEOS EXCLUSIVOS (7 cols) */}
                    <div className="lg:col-span-7 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-2xl min-h-[450px] flex flex-col justify-end p-10">
                        <div className="absolute inset-0 bg-[url('/images/multimedia_background.webp')] bg-cover bg-center opacity-70 group-hover:opacity-80 transition-opacity duration-700 group-hover:scale-105 transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 text-white border border-white/20">
                                <GraduationCap size={28} />
                            </div>
                            <h3 className="text-3xl font-serif text-white mb-4">{b.videos}</h3>
                            <p className="text-gray-200 text-lg leading-relaxed max-w-xl mb-6">
                                {b.videosDesc}
                            </p>
                            <div className="flex items-center gap-2 text-white/70 text-sm font-bold uppercase tracking-widest group-hover:text-white transition-colors">
                                {b.videosLink} <ArrowRight size={14} />
                            </div>
                        </div>
                    </div>

                    {/* 5% LIVROS (5 cols) - Moved Up & Expanded */}
                    <div className="lg:col-span-5 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-2xl min-h-[450px] flex flex-col justify-end p-10">
                        <div className="absolute inset-0 bg-[url('/images/descontoslivros.webp')] bg-cover bg-center opacity-70 group-hover:opacity-80 transition-opacity duration-700 group-hover:scale-105 transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 text-white border border-white/20">
                                <BookOpen size={28} />
                            </div>
                            <h3 className="text-3xl font-serif text-white mb-4">{b.discount}</h3>
                            <p className="text-gray-200 text-lg leading-relaxed mb-6">
                                {b.discountDesc}
                            </p>
                        </div>
                    </div>


                    {/* --- ROW 2 (Spiritual & Experience) --- */}

                    {/* ITEM 1: ALTAR (4 cols) */}
                    <div className="lg:col-span-4 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-xl flex flex-col justify-end p-8 min-h-[350px]">
                        <div className="absolute inset-0 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-70 group-hover:opacity-80 transition-opacity duration-700 group-hover:scale-110 transform transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 backdrop-blur-md flex items-center justify-center mb-4 text-orange-300 border border-orange-500/30">
                                <Church size={24} />
                            </div>
                            <h3 className="text-xl font-serif font-bold text-white mb-3">{b.altar}</h3>
                            <p className="text-gray-300 text-sm font-light leading-relaxed">
                                {b.altarDesc}
                            </p>
                        </div>
                    </div>

                    {/* ITEM 2: MISSAS ANUAIS (4 cols) */}
                    <div className="lg:col-span-4 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-xl flex flex-col justify-end p-8 min-h-[350px]">
                        <div className="absolute inset-0 bg-[url('/images/padrerezar.webp')] bg-cover bg-center opacity-70 group-hover:opacity-80 transition-opacity duration-700 group-hover:scale-110 transform transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 text-white border border-white/20">
                                <Church size={24} />
                            </div>
                            <h3 className="text-xl font-serif font-bold text-white mb-3">{b.masses}</h3>
                            <p className="text-gray-300 text-sm font-light leading-relaxed">
                                {b.massesDesc}
                            </p>
                        </div>
                    </div>

                    {/* ITEM 3: VOUCHER (4 cols) */}
                    <div className="lg:col-span-4 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-xl flex flex-col justify-end p-8 min-h-[350px]">
                        <div className="absolute inset-0 bg-[url('/images/aldeiadacasa.webp')] bg-cover bg-center opacity-60 group-hover:opacity-75 transition-opacity duration-700 group-hover:scale-110 transform transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 text-white border border-white/20">
                                <Ticket size={24} />
                            </div>
                            <h3 className="text-xl font-serif font-bold text-white mb-3">{b.voucher}</h3>
                            <p className="text-gray-300 text-sm font-light leading-relaxed">
                                {b.voucherDesc}
                            </p>
                        </div>
                    </div>


                    {/* --- ROW 3 (Community & Events) --- */}

                    {/* VIDA ASSOCIATIVA (6 cols) */}
                    <div className="lg:col-span-6 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-xl flex flex-col justify-end p-8 min-h-[300px]">
                        <div className="absolute inset-0 bg-[url('/images/associacao.webp')] bg-cover bg-center opacity-60 group-hover:opacity-75 transition-opacity duration-700 group-hover:scale-110 transform transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 text-white border border-white/20">
                                <Users size={24} />
                            </div>
                            <h3 className="text-xl font-serif font-bold text-white mb-3">{b.community}</h3>
                            <p className="text-gray-300 text-sm font-light leading-relaxed">
                                {b.communityDesc}
                            </p>
                        </div>
                    </div>

                    {/* 5% CONFERENCIAS (6 cols) */}
                    <div className="lg:col-span-6 relative group rounded-[2.5rem] overflow-hidden bg-black shadow-xl flex flex-col justify-end p-8 min-h-[300px]">
                        <div className="absolute inset-0 bg-[url('/images/espalharpalavra.webp')] bg-cover bg-center opacity-50 group-hover:opacity-65 transition-opacity duration-700 group-hover:scale-105 transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 text-white border border-white/20">
                                <Mic2 size={24} />
                            </div>
                            <h3 className="text-xl font-serif font-bold text-white mb-3">{b.conferences}</h3>
                            <p className="text-gray-300 text-sm font-light leading-relaxed">
                                {b.conferencesDesc}
                            </p>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
}
