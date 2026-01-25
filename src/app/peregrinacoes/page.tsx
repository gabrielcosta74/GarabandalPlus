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
import { getPilgrimagesAction } from './actions';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    description: string;
    cover_image: string;
    start_date: string;
    end_date: string;
    base_price: number;
    total_vacancies: number;
    confirmed_pax: number;
    effective_vacancies: number;
    status: string;
    meeting_point_text?: string;
    meeting_end_text?: string;
    flight_info_text?: string;
    payment_plan_text?: string;
    cancellation_policy_text?: string;
    not_included_items?: string[];
};

export default function PilgrimagesPage() {
    const [pilgrimages, setPilgrimages] = useState<Pilgrimage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchPilgrimages = async () => {
            console.log("🚀 [Peregrinacoes] Fetching pilgrimages...");
            try {
                // Prefer server action to avoid client-side auth/rpc stalls
                const actionResult = await getPilgrimagesAction();
                if (!mounted) return;
                if (actionResult?.data) {
                    setPilgrimages(actionResult.data as any);
                    return;
                }
                console.warn("⚠️ [Peregrinacoes] Server action failed:", actionResult?.error);

                if (!supabaseBrowser) {
                    console.warn("⚠️ [Peregrinacoes] Supabase client missing");
                    return;
                }

                // Use RPC for better performance and bypassed RLS for aggregates
                const { data, error } = await supabaseBrowser
                    .rpc('get_pilgrimage_list', {});

                if (error) {
                    console.error("❌ [Peregrinacoes] Fetch error:", error);
                    // Fallback to direct table access
                    const { data: fallbackData } = await supabaseBrowser
                        .from('pilgrimages')
                        .select('*')
                        .order('start_date', { ascending: true });
                    if (fallbackData && mounted) setPilgrimages(fallbackData as any);
                } else {
                    console.log("✅ [Peregrinacoes] Fetched:", data?.length);
                    if (data && mounted) setPilgrimages(data);
                }
            } catch (err) {
                console.error("❌ [Peregrinacoes] Unexpected error:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchPilgrimages();
        return () => {
            mounted = false;
        };
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
                                Deixe o seu contacto para receber notícias sobre novas datas e caminhos de peregrinação.
                            </p>
                            <GeneralWaitlistForm />
                        </div>
                    </div>

                </div>
            </div>
        </VIPLayout>
    );
}

function GeneralWaitlistForm() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        try {
            const res = await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    type: 'general_waitlist',
                    channel_preference: 'email'
                })
            });

            if (res.ok) {
                setStatus('success');
                setEmail('');
            } else {
                setStatus('error');
            }
        } catch (error) {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 max-w-md mx-auto animate-fade-in text-center">
                <p className="text-green-400 font-medium mb-1">✨ Inscrição confirmada</p>
                <p className="text-green-400/80 text-sm">Será contactado pelo Apostolado quando surgir uma nova peregrinação.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative">
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="O seu melhor email"
                disabled={loading}
                className="w-full sm:flex-1 h-16 shrink-0 text-lg rounded-xl px-4 bg-white/10 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 disabled:opacity-50 appearance-none"
            />
            <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto h-16 shrink-0 px-8 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] text-lg"
            >
                {loading ? <div className="animate-spin w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full" /> : 'Avise-me'}
            </button>
            {status === 'error' && (
                <div className="absolute -bottom-8 left-0 w-full text-center">
                    <p className="text-red-400 text-sm">Ocorreu um erro. Tente novamente.</p>
                </div>
            )}
        </form>
    );
}
