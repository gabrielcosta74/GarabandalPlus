"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { MapPin, Calendar, Users, ChevronRight, Info } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
            {/* Light Mode Container Override - using absolute positioning or just a full covering div logic */}
            <div className="bg-slate-50 min-h-screen rounded-3xl p-6 md:p-12 shadow-2xl overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-yellow-400/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

                <div className="relative z-10 space-y-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 border border-yellow-200 text-xs font-bold uppercase tracking-wider text-yellow-800 mb-4">
                                <MapPin className="w-3 h-3" />
                                Viagens Oficiais
                            </div>
                            <h1 className="font-serif text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
                                Peregrinações
                            </h1>
                            <p className="text-slate-600 text-lg max-w-2xl leading-relaxed">
                                Jornadas de fé organizadas pelo Apostolado. Mais do que uma viagem, um encontro com a mensagem de Garabandal.
                            </p>
                        </div>

                        <Link
                            href="/peregrinacoes/minhas-inscricoes"
                            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-full text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                        >
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            Minhas Inscrições
                        </Link>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="text-center py-24">
                            <div className="animate-spin w-10 h-10 border-3 border-yellow-600 border-t-transparent rounded-full mx-auto mb-6" />
                            <p className="text-slate-500 font-medium">A carregar viagens...</p>
                        </div>
                    ) : pilgrimages.length === 0 ? (
                        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center shadow-sm">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                                <MapPin className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-3">Sem peregrinações ativas</h3>
                            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                                De momento não temos inscrições abertas para novas viagens. Subscreve a newsletter para seres o primeiro a saber.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-12">
                            {pilgrimages.map((pilgrimage) => {
                                const startDate = new Date(pilgrimage.start_date);
                                const endDate = new Date(pilgrimage.end_date);
                                const isWaitlist = pilgrimage.status === 'waitlist';
                                const isClosed = pilgrimage.status === 'closed';

                                return (
                                    <Link
                                        key={pilgrimage.id}
                                        href={`/peregrinacoes/${pilgrimage.slug}`}
                                        className="group bg-white rounded-3xl border border-slate-100 overflow-hidden hover:border-yellow-500/30 transition-all hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] flex flex-col md:flex-row h-full transform hover:-translate-y-1"
                                    >
                                        {/* Image Section */}
                                        <div className="md:w-5/12 relative overflow-hidden h-64 md:h-auto">
                                            {pilgrimage.cover_image && (
                                                <img
                                                    src={pilgrimage.cover_image}
                                                    alt={pilgrimage.title}
                                                    className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10" />

                                            {/* Badge */}
                                            <div className="absolute top-6 left-6">
                                                {isWaitlist ? (
                                                    <span className="bg-white/95 text-orange-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500" /> Lista de Espera
                                                    </span>
                                                ) : isClosed ? (
                                                    <span className="bg-white/95 text-red-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" /> Esgotado
                                                    </span>
                                                ) : (
                                                    <span className="bg-white/95 text-green-700 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Inscrições Abertas
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content Section */}
                                        <div className="p-8 md:p-12 flex-1 flex flex-col justify-center">
                                            <div className="flex items-center gap-3 text-yellow-600 text-sm font-bold uppercase tracking-wider mb-4">
                                                <Calendar className="w-4 h-4" />
                                                <span>
                                                    {format(startDate, "d 'de' MMMM", { locale: pt })} a {format(endDate, "d 'de' MMMM, yyyy", { locale: pt })}
                                                </span>
                                            </div>

                                            <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-6 group-hover:text-yellow-700 transition-colors">
                                                {pilgrimage.title}
                                            </h3>

                                            <p className="text-slate-600 text-lg leading-relaxed mb-8 line-clamp-2 md:line-clamp-3">
                                                {pilgrimage.description}
                                            </p>

                                            <div className="flex items-center justify-between border-t border-slate-100 pt-8 mt-auto">
                                                <div>
                                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Donativo Base</p>
                                                    <p className="text-2xl font-bold text-slate-900">{pilgrimage.base_price}€</p>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Lugares</p>
                                                        <div className="flex items-center justify-end gap-1 text-sm font-bold text-slate-700">
                                                            <Users className="w-4 h-4 text-slate-400" />
                                                            {pilgrimage.current_vacancies} Livres
                                                        </div>
                                                    </div>

                                                    <div className="h-12 w-12 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-yellow-500 group-hover:bg-yellow-500 group-hover:text-white transition-all ml-4">
                                                        <ChevronRight className="w-6 h-6" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </VIPLayout>
    );
}
