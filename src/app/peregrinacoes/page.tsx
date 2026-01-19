"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { MapPin, Calendar, Users, ChevronRight, Info, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PilgrimageHero } from '../../components/pilgrimage/PilgrimageHero';
import { PilgrimageCard } from '../../components/pilgrimage/PilgrimageCard';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    description: string;
    cover_image: string;
    start_date: string;
    end_date: string;
    total_vacancies: number;
    current_vacancies: number;
    base_price: number;
    status: string;
};

export default function PilgrimagesPage() {
    const [pilgrimages, setPilgrimages] = useState<Pilgrimage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPilgrimages = async () => {
            if (!supabaseBrowser) return;

            const { data, error } = await supabaseBrowser
                .from('pilgrimages')
                .select('*')
                .order('start_date', { ascending: true });

            if (data) setPilgrimages(data);
            setLoading(false);
        };

        fetchPilgrimages();
    }, []);

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-[#f8fafc] min-h-screen rounded-[2.5rem] p-6 md:p-10 shadow-sm overflow-hidden relative">

                <PilgrimageHero featuredPilgrimage={pilgrimages.length > 0 ? pilgrimages[0] : undefined} />

                <div className="relative z-10 max-w-6xl mx-auto">
                    {/* Trust Indicators / Value Prop */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4 hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">Pequenos Grupos</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">Experiência intimista e acompanhamento personalizado.</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4 hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">100% Organizado</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">Voos, hotéis e refeições incluídos. Sem preocupações.</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4 hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">Roteiro Espiritual</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">Programa diário com missa, terço e conferências.</p>
                            </div>
                        </div>
                    </div>

                    {/* Listings Header */}
                    <div className="flex items-end justify-between mb-8 px-2">
                        <div>
                            <h2 className="text-3xl font-serif font-bold text-slate-900">Próximas Partidas</h2>
                            <p className="text-slate-500 mt-1">Reserve o seu lugar antes que esgote.</p>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="text-center py-24">
                            <div className="animate-spin w-10 h-10 border-3 border-yellow-500 border-t-transparent rounded-full mx-auto mb-6" />
                            <p className="text-slate-500 font-medium animate-pulse">A carregar viagens inspiradoras...</p>
                        </div>
                    ) : pilgrimages.length === 0 ? (
                        <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-16 text-center shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <MapPin className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-3">Sem peregrinações ativas</h3>
                            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                                De momento não temos inscrições abertas. Subscreva a newsletter para ser o primeiro a saber.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8">
                            {pilgrimages.map((pilgrimage, idx) => (
                                <PilgrimageCard key={pilgrimage.id} pilgrimage={pilgrimage} index={idx} />
                            ))}
                        </div>
                    )}

                    {/* Newsletter / Waitlist CTA */}
                    <div className="mt-20 bg-slate-900 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-yellow-500/10 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2" />
                        <div className="relative z-10 max-w-2xl mx-auto">
                            <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">Não encontrou a data ideal?</h3>
                            <p className="text-slate-400 mb-8">
                                Inscreva-se na nossa lista VIP para receber notificações prioritárias sobre novas datas e roteiros exclusivos.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                                <input
                                    type="email"
                                    placeholder="O seu melhor email"
                                    className="flex-1 h-12 rounded-xl px-4 bg-white/10 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                />
                                <button className="h-12 px-8 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl transition-colors">
                                    Avise-me
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </VIPLayout>
    );
}
