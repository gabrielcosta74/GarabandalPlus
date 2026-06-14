"use client";

import { useState, useEffect } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { motion } from 'framer-motion';
import { PlayCircle, BookOpen, ArrowRight, LayoutGrid, CheckCircle2, Flame, Users, Award, Heart } from 'lucide-react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useLocale } from '../../../contexts/LocaleContext';
import IntentionsWall from '../../../components/member/IntentionsWall';

// --- Types ---
type NovenaSummary = {
    id: string;
    title: string;
    title_en?: string | null;
    description: string;
    description_en?: string | null;
    image_url: string | null;
    slug: string;
};

type NovenaProgressSummary = {
    novena_id: string;
    current_day: number;
    is_complete: boolean;
};

type CommunityStats = {
    total_completed: number;
    completed_this_month: number;
    active_now: number;
};

type PersonalStats = {
    completed: number;
    inProgress: number;
    prayerDays: number;
    streak: number; // best active journey: days already prayed in an in-progress novena
};

// --- Spiritual milestones (derived from completed novenas count) ---
type Milestone = { threshold: number; pt: string; en: string };
const MILESTONES: Milestone[] = [
    { threshold: 1, pt: 'Primeira Novena', en: 'First Novena' },
    { threshold: 3, pt: 'Perseverança', en: 'Perseverance' },
    { threshold: 5, pt: 'Coração Orante', en: 'Prayerful Heart' },
    { threshold: 9, pt: 'Guerreiro de Oração', en: 'Prayer Warrior' },
];

export default function NovenasHubPage() {
    const { locale } = useLocale();
    const [novenas, setNovenas] = useState<NovenaSummary[]>([]);
    const [progressMap, setProgressMap] = useState<Record<string, NovenaProgressSummary>>({});
    const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
    const [community, setCommunity] = useState<CommunityStats | null>(null);
    const [personal, setPersonal] = useState<PersonalStats | null>(null);
    const [loading, setLoading] = useState(true);
    const isEn = locale === 'en';
    const novenasBasePath = isEn ? '/en/member/novenas' : '/member/novenas';

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

            if (novenaList) {
                setNovenas(
                    novenaList.map((novena: any) => ({
                        ...novena,
                        title: isEn ? novena.title_en || novena.title : novena.title,
                        description: isEn ? novena.description_en || novena.description : novena.description,
                    }))
                );
            }

            // 2. Fetch User Progress + completion history (if logged in)
            if (userId) {
                const [{ data: progressList }, { data: historyList }] = await Promise.all([
                    supabaseBrowser
                        .from('novena_progress')
                        .select('novena_id, current_day, is_complete')
                        .eq('user_id', userId),
                    supabaseBrowser
                        .from('novena_history')
                        .select('id')
                        .eq('user_id', userId),
                ]);

                const map: Record<string, NovenaProgressSummary> = {};
                let inProgress = 0;
                let activeDays = 0; // days prayed on journeys not yet finished
                let bestStreak = 0; // strongest active journey (days already prayed in it)
                if (progressList) {
                    progressList.forEach((p: any) => {
                        map[p.novena_id] = p;
                        if (!p.is_complete) {
                            inProgress += 1;
                            const prayed = Math.max(0, (p.current_day ?? 1) - 1);
                            activeDays += prayed;
                            bestStreak = Math.max(bestStreak, prayed);
                        }
                    });
                }
                setProgressMap(map);

                const completed = historyList?.length ?? 0;
                setPersonal({
                    completed,
                    inProgress,
                    // Completed novenas = 9 days each; in-progress = days already prayed.
                    prayerDays: completed * 9 + activeDays,
                    streak: bestStreak,
                });
            }

            // 3. Community communion stats (aggregate-only RPCs). Degrade gracefully
            //    if the functions are not yet deployed — community UI just hides.
            const [statsRes, countsRes] = await Promise.all([
                supabaseBrowser.rpc('get_novena_community_stats'),
                supabaseBrowser.rpc('get_novena_active_counts'),
            ]);

            if (!statsRes.error && statsRes.data) {
                setCommunity(statsRes.data as CommunityStats);
            }
            if (!countsRes.error && Array.isArray(countsRes.data)) {
                const counts: Record<string, number> = {};
                countsRes.data.forEach((row: any) => {
                    counts[row.novena_id] = Number(row.active_count) || 0;
                });
                setActiveCounts(counts);
            }

            setLoading(false);
        };
        loadData();
    }, [isEn]);

    const nextMilestone = personal
        ? MILESTONES.find(m => personal.completed < m.threshold) ?? null
        : null;

    return (
        <VIPLayout>
            <div className="max-w-6xl mx-auto pb-20">
                {/* Header */}
                <div className="mb-10 md:mb-14">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <BookOpen className="w-3.5 h-3.5" />
                            {isEn ? 'Spiritual Library' : 'Biblioteca Espiritual'}
                        </div>
                        <h1 className="font-serif text-3xl md:text-5xl font-bold text-white tracking-tight">
                            {isEn ? 'Novenas & Prayer Journeys' : 'Novenas & Jornadas'}
                        </h1>
                        <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
                            {isEn ? 'Choose a path of prayer. Pray for 9 days and strengthen your faith.' : 'Escolhe um caminho de oração. Reza durante 9 dias e fortalece a tua fé.'}
                        </p>
                    </div>
                </div>

                {/* Personal prayer path */}
                {personal && (personal.completed > 0 || personal.inProgress > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 md:mb-12 rounded-3xl border border-white/5 bg-slate-900/60 p-5 md:p-7"
                    >
                        <h2 className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-5 flex items-center gap-2">
                            <Heart className="w-3.5 h-3.5" />
                            {isEn ? 'Your Prayer Path' : 'O Teu Caminho de Oração'}
                        </h2>

                        {/* Active streak highlight */}
                        {personal.streak > 0 && (
                            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_18px_rgba(251,191,36,0.35)]">
                                    <Flame className="w-5 h-5 text-slate-950" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-bold leading-tight">
                                        {personal.streak} {personal.streak === 1 ? (isEn ? 'day in a row' : 'dia em sequência') : (isEn ? 'days in a row' : 'dias em sequência')}
                                    </p>
                                    <p className="text-amber-300/80 text-xs leading-snug">
                                        {isEn ? 'Pray today to keep it alive' : 'Reze hoje para manter sua sequência viva'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 md:gap-4">
                            {[
                                { value: personal.completed, label: isEn ? 'Completed' : 'Concluídas' },
                                { value: personal.prayerDays, label: isEn ? 'Prayer days' : 'Dias de oração' },
                                { value: personal.inProgress, label: isEn ? 'In progress' : 'Em curso' },
                            ].map((s, i) => (
                                <div key={i} className="text-center">
                                    <p className="text-3xl md:text-4xl font-serif font-bold text-white leading-none">{s.value}</p>
                                    <p className="text-[10px] md:text-[11px] uppercase tracking-wider text-slate-500 mt-2 leading-tight">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Next milestone — single quiet progress line */}
                        {nextMilestone ? (
                            <div className="mt-6 pt-5 border-t border-white/5">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                                    <Award className="w-3 h-3 text-amber-400/70" />
                                    {isEn ? 'Next milestone' : 'Próxima conquista'}
                                </p>
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-sm text-slate-300 font-medium">{isEn ? nextMilestone.en : nextMilestone.pt}</span>
                                    <span className="text-xs text-slate-500">
                                        {personal.completed}/{nextMilestone.threshold} {isEn ? 'novenas' : 'novenas'}
                                    </span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (personal.completed / nextMilestone.threshold) * 100)}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className="bg-amber-400 h-full rounded-full"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 pt-5 border-t border-white/5 flex items-center gap-2 text-sm text-amber-300">
                                <Award className="w-4 h-4" />
                                {isEn ? 'All milestones reached' : 'Todas as conquistas alcançadas'}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Community communion — single quiet line */}
                {community && (community.total_completed > 0 || community.active_now > 0) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-8 md:mb-12 flex items-center gap-2.5 text-sm text-slate-400"
                    >
                        <Users className="w-4 h-4 text-slate-500 shrink-0" />
                        <p className="leading-snug">
                            {isEn ? (
                                <>You&apos;re never praying alone · <span className="text-slate-200 font-semibold">{community.total_completed.toLocaleString('en')}</span> novenas prayed{community.active_now > 0 && <> · <span className="text-slate-200 font-semibold">{community.active_now}</span> on a journey this week</>}</>
                            ) : (
                                <>Nunca rezas sozinho · <span className="text-slate-200 font-semibold">{community.total_completed.toLocaleString('pt')}</span> novenas rezadas{community.active_now > 0 && <> · <span className="text-slate-200 font-semibold">{community.active_now}</span> em jornada esta semana</>}</>
                            )}
                        </p>
                    </motion.div>
                )}

                {/* Catalogue heading */}
                {!loading && novenas.length > 0 && (
                    <h2 className="font-serif text-2xl text-white mb-6 flex items-center gap-2.5">
                        <LayoutGrid className="w-5 h-5 text-slate-500" />
                        {isEn ? 'Choose a Novena' : 'Escolhe uma Novena'}
                    </h2>
                )}

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[380px] md:h-[420px] bg-slate-900 rounded-3xl animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : novenas.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-white/5">
                        <p className="text-slate-500">{isEn ? 'No novenas available right now.' : 'Nenhuma novena disponível de momento.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {novenas.map((novena, index) => {
                            const progress = progressMap[novena.id];
                            const isStarted = !!progress;
                            const isCompleted = progress?.is_complete;
                            const activeHere = activeCounts[novena.id] || 0;

                            return (
                                <motion.div
                                    key={novena.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-40px' }}
                                    transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: 'easeOut' }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Link
                                        href={`${novenasBasePath}/${novena.id}`}
                                        className="group relative block h-[380px] md:h-[420px] rounded-3xl overflow-hidden bg-slate-900 border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        {/* Image */}
                                        <div className="absolute inset-0 z-0">
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent z-10" />
                                            <img
                                                src={novena.image_url || '/placeholder-saint.jpg'}
                                                alt={novena.title}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                        </div>

                                        {/* Status badge (single) */}
                                        <div className="absolute top-4 left-4 z-20">
                                            {isCompleted ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/70 backdrop-blur text-white text-xs font-semibold rounded-full border border-white/15">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> {isEn ? 'Completed' : 'Concluída'}
                                                </span>
                                            ) : isStarted ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/70 backdrop-blur text-amber-300 text-xs font-semibold rounded-full border border-amber-400/30">
                                                    <PlayCircle className="w-3.5 h-3.5" /> {isEn ? `Day ${progress.current_day}` : `Dia ${progress.current_day}`}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-3 py-1.5 bg-slate-950/70 backdrop-blur text-slate-300 text-xs font-semibold rounded-full border border-white/15">
                                                    {isEn ? 'New' : 'Nova'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Community: members on this journey this week */}
                                        {activeHere > 0 && (
                                            <div className="absolute top-4 right-4 z-20">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-950/70 backdrop-blur text-slate-300 text-xs font-medium rounded-full border border-white/10">
                                                    <Flame className="w-3 h-3" />
                                                    {activeHere}
                                                </span>
                                            </div>
                                        )}

                                        {/* Content (Bottom) */}
                                        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-7 z-20 space-y-3">
                                            <h3 className="text-xl md:text-2xl font-serif font-bold text-white leading-tight">
                                                {novena.title}
                                            </h3>
                                            <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">
                                                {novena.description}
                                            </p>

                                            {/* Progress (always visible when in progress) */}
                                            {isStarted && !isCompleted && (
                                                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                                    <div
                                                        className="bg-amber-400 h-full rounded-full"
                                                        style={{ width: `${(progress.current_day / 9) * 100}%` }}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center text-sm font-semibold text-amber-400 pt-1">
                                                {isStarted ? (isEn ? 'Continue' : 'Continuar') : (isEn ? 'Start now' : 'Começar')}
                                                <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Community wall of intentions */}
                <IntentionsWall />
            </div>
        </VIPLayout>
    );
}
