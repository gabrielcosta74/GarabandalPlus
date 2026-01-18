"use client";

import { useState, useEffect } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { motion } from 'framer-motion';
import { Calendar, PlayCircle, Lock, BookOpen, Star, Sparkles, ArrowRight, LayoutGrid, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';

// --- Types ---
type NovenaSummary = {
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    slug: string;
};

type NovenaProgressSummary = {
    novena_id: string;
    current_day: number;
    is_complete: boolean;
};

export default function NovenasHubPage() {
    const [novenas, setNovenas] = useState<NovenaSummary[]>([]);
    const [progressMap, setProgressMap] = useState<Record<string, NovenaProgressSummary>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!supabaseBrowser) {
                setLoading(false);
                return;
            }

            const { data: { session } } = await supabaseBrowser.auth.getSession();
            const userId = session?.user?.id;

            // 1. Fetch Published Novenas
            const { data: novenaList } = await supabaseBrowser
                .from('novenas')
                .select('*')
                .eq('published', true)
                .order('created_at', { ascending: false }); // Newest first

            if (novenaList) setNovenas(novenaList);

            // 2. Fetch User Progress (if logged in)
            if (userId) {
                const { data: progressList } = await supabaseBrowser
                    .from('novena_progress')
                    .select('novena_id, current_day, is_complete')
                    .eq('user_id', userId);

                if (progressList) {
                    const map: Record<string, NovenaProgressSummary> = {};
                    progressList.forEach((p: any) => {
                        map[p.novena_id] = p;
                    });
                    setProgressMap(map);
                }
            }

            setLoading(false);
        };
        loadData();
    }, []);

    return (
        <VIPLayout>
            <div className="max-w-6xl mx-auto pb-20">
                {/* Header */}
                <div className="mb-12 text-center md:text-left md:flex md:items-end md:justify-between border-b border-white/5 pb-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm font-bold uppercase tracking-wider text-indigo-400">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            Biblioteca Espiritual
                        </div>
                        <h1 className="font-serif text-4xl md:text-5xl font-bold text-white">
                            Novenas & Jornadas
                        </h1>
                        <p className="text-slate-400 text-lg max-w-2xl">
                            Escolhe um caminho de oração. Reza durante 9 dias e fortalece a tua fé.
                        </p>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-96 bg-slate-900 rounded-3xl animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : novenas.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900 rounded-3xl border border-white/5">
                        <p className="text-slate-500">Nenhuma novena disponível de momento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {novenas.map((novena, index) => {
                            const progress = progressMap[novena.id];
                            const isStarted = !!progress;
                            const isCompleted = progress?.is_complete;

                            return (
                                <Link
                                    key={novena.id}
                                    href={`/member/novenas/${novena.id}`}
                                    className="group relative block h-[450px] rounded-3xl overflow-hidden bg-slate-900 border border-white/10 hover:border-indigo-500/50 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                                >
                                    {/* Image Background */}
                                    <div className="absolute inset-0 z-0">
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-10" />
                                        <img
                                            src={novena.image_url || '/placeholder-saint.jpg'}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    </div>

                                    {/* Badges */}
                                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                                        {isCompleted && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                                                <CheckCircle2 className="w-3 h-3" /> Concluída
                                            </span>
                                        )}
                                        {isStarted && !isCompleted && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full shadow-lg">
                                                <PlayCircle className="w-3 h-3" /> Em Curso: Dia {progress.current_day}
                                            </span>
                                        )}
                                        {!isStarted && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900/80 backdrop-blur text-slate-300 text-xs font-bold rounded-full border border-white/10">
                                                Nova Jornada
                                            </span>
                                        )}
                                    </div>

                                    {/* Content (Bottom) */}
                                    <div className="absolute bottom-0 left-0 right-0 p-8 z-20 space-y-4">
                                        <h2 className="text-2xl font-serif font-bold text-white leading-tight group-hover:text-indigo-400 transition-colors">
                                            {novena.title}
                                        </h2>
                                        <p className="text-slate-400 text-sm line-clamp-2">
                                            {novena.description}
                                        </p>

                                        {/* Progress Bar (Visual only if started) */}
                                        {isStarted && !isCompleted && (
                                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                                                <div
                                                    className="bg-indigo-500 h-full rounded-full"
                                                    style={{ width: `${(progress.current_day / 9) * 100}%` }}
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center text-sm font-bold text-white pt-2">
                                            {isStarted ? 'Continuar Rezar' : 'Começar Agora'}
                                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform text-indigo-500" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </VIPLayout>
    );
}
