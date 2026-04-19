"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VIPLayout from '../../../../components/member/VIPLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle, ChevronRight, Lock, BookOpen, Sparkles, ArrowLeft, X, Home } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useLocale } from '../../../../contexts/LocaleContext';

// --- Types ---
type NovenaFull = {
    id: string;
    title: string;
    title_en?: string | null;
    description: string;
    description_en?: string | null;
    image_url: string | null;
    prayer_intro: string;
    prayer_intro_en?: string | null;
    prayer_final: string;
    prayer_final_en?: string | null;
    days: {
        day_number: number;
        theme: string;
        content: string;
        image_url?: string | null;
        audio_url?: string | null;
    }[];
};

type NovenaProgress = {
    current_day: number;
    start_date: string;
    last_completed_date: string | null;
    is_complete: boolean;
};

const CATHOLIC_QUOTES_PT = [
    "Tudo posso naquele que me fortalece. (Filipenses 4:13)",
    "A oração é a chave que abre o coração de Deus.",
    "Quem a Deus tem, nada lhe falta. Só Deus basta. (Santa Teresa de Ávila)",
    "Não tenhas medo, pois Eu estou contigo. (Isaías 41:10)",
    "A medida do amor é amar sem medida. (Santo Agostinho)",
    "O amor de Deus não se cansa nunca de perdoar. (Papa Francisco)",
    "Servir a Deus é reinar.",
    "Onde houver ódio, que eu leve o amor. (São Francisco de Assis)"
];

const CATHOLIC_QUOTES_EN = [
    "I can do all things through Him who strengthens me. (Philippians 4:13)",
    "Prayer is the key that opens the heart of God.",
    "He who has God lacks nothing. God alone is enough. (Saint Teresa of Avila)",
    "Do not be afraid, for I am with you. (Isaiah 41:10)",
    "The measure of love is to love without measure. (Saint Augustine)",
    "God never tires of forgiving. (Pope Francis)",
    "To serve God is to reign.",
    "Where there is hatred, let me bring love. (Saint Francis of Assisi)"
];

export default function NovenaPlayerPage() {
    const params = useParams(); // { id }
    const router = useRouter();
    const { locale } = useLocale();
    const [novena, setNovena] = useState<NovenaFull | null>(null);
    const [progress, setProgress] = useState<NovenaProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [completedDayQuote, setCompletedDayQuote] = useState<string | null>(null);
    const isEn = locale === 'en';
    const loginPath = isEn ? '/en/login' : '/login';
    const novenasPath = isEn ? '/en/member/novenas' : '/member/novenas';

    // Initial Load
    useEffect(() => {
        const init = async () => {
            if (!supabaseBrowser || !params.id) return;

            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) {
                router.push(loginPath);
                return;
            }
            setUserId(session.user.id);

            // 1. Fetch Novena + Days
            const { data: novenaData, error: novenaError } = await supabaseBrowser
                .from('novenas')
                .select(`
                    *,
                    days:novena_days(*)
                `)
                .eq('id', params.id)
                .single();

            if (novenaError || !novenaData) {
                alert(isEn ? 'Novena not found.' : 'Novena não encontrada.');
                router.push(novenasPath);
                return;
            }

            // Sort days (ensure 1-9 order)
            novenaData.days.sort((a: any, b: any) => a.day_number - b.day_number);
            novenaData.title = isEn ? novenaData.title_en || novenaData.title : novenaData.title;
            novenaData.description = isEn ? novenaData.description_en || novenaData.description : novenaData.description;
            novenaData.prayer_intro = isEn ? novenaData.prayer_intro_en || novenaData.prayer_intro : novenaData.prayer_intro;
            novenaData.prayer_final = isEn ? novenaData.prayer_final_en || novenaData.prayer_final : novenaData.prayer_final;
            setNovena(novenaData);

            // 2. Fetch Progress
            const { data: progData } = await supabaseBrowser
                .from('novena_progress')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('novena_id', params.id)
                .maybeSingle();

            if (progData) {
                setProgress(progData);
            } else {
                // Not started (or auto-start logic?)
                // Let's rely on explicit start button if null
            }

            setLoading(false);
        };
        init();
    }, [isEn, loginPath, novenasPath, params.id, router]);

    // Actions
    const startNovena = async () => {
        if (!userId || !novena) return;
        const startPayload = {
            user_id: userId,
            novena_id: novena.id,
            current_day: 1,
            start_date: new Date().toISOString(),
            is_complete: false
        };

        const { error } = await supabaseBrowser
            .from('novena_progress')
            .upsert(startPayload, { onConflict: 'user_id, novena_id' });

        if (!error) {
            setProgress({ ...startPayload, last_completed_date: null });
        }
    };

    const completeDay = async () => {
        if (!progress || !novena || !userId) return;

        const isFinalDay = progress.current_day === 9;
        const now = new Date().toISOString();

        // Quote
        const sourceQuotes = isEn ? CATHOLIC_QUOTES_EN : CATHOLIC_QUOTES_PT;
        const randomQuote = sourceQuotes[Math.floor(Math.random() * sourceQuotes.length)];
        setCompletedDayQuote(randomQuote);

        let updatePayload: any = {
            user_id: userId,
            novena_id: novena.id,
            last_completed_date: now,
            updated_at: now
        };

        if (isFinalDay) {
            // Confetti
            confetti({
                particleCount: 150,
                spread: 100,
                colors: ['#FFD700', '#FFFFFF', '#4F46E5'],
                zIndex: 3000
            });

            updatePayload.is_complete = true;
            updatePayload.current_day = 9;

            // Add History Record
            await supabaseBrowser.from('novena_history').insert({
                user_id: userId,
                novena_id: novena.id,
                title: novena.title,
                completed_at: now
            });

        } else {
            updatePayload.current_day = progress.current_day + 1;
            updatePayload.is_complete = false;
        }

        const { error } = await supabaseBrowser
            .from('novena_progress')
            .upsert(updatePayload, { onConflict: 'user_id, novena_id' });

        if (!error) {
            setProgress(prev => prev ? { ...prev, ...updatePayload } : null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const resetNovena = async () => {
        if (!userId || !novena) return;
        if (confirm(isEn ? 'Are you sure you want to restart? Your current progress will be lost.' : 'Tens a certeza que desejas reiniciar? O progresso atual será perdido.')) {
            await supabaseBrowser
                .from('novena_progress')
                .delete()
                .eq('user_id', userId)
                .eq('novena_id', novena.id);
            setProgress(null);
        }
    };

    // Render Helpers
    if (loading || !novena) {
        return (
            <VIPLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </VIPLayout>
        );
    }

    const currentDayData = progress
        ? novena.days.find(d => d.day_number === progress.current_day)
        : novena.days[0];

    return (
        <VIPLayout>
            <div className="max-w-4xl mx-auto pb-20">
                {/* Nav */}
                <div className="mb-8 flex items-center justify-between">
                    <Link href={novenasPath} className="inline-flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {isEn ? 'My Novenas' : 'Minhas Novenas'}
                    </Link>
                </div>

                {/* Progress State Check */}
                {!progress ? (
                    // --- PRE-START SCREEN ---
                    <div className="bg-slate-900 rounded-3xl border border-white/10 p-8 md:p-12 text-center relative overflow-hidden">
                        {/* Background Effect */}
                        {novena.image_url && (
                            <div className="absolute inset-0 opacity-20">
                                <img src={novena.image_url} className="w-full h-full object-cover blur-sm" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
                            </div>
                        )}

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-indigo-500/20">
                                <img src={novena.image_url || '/placeholder-saint.jpg'} className="w-full h-full object-cover" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-serif text-white mb-4">{novena.title}</h1>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
                                {novena.description}
                            </p>
                            <button
                                onClick={startNovena}
                                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-xl shadow-indigo-600/30 flex items-center gap-2 text-lg"
                            >
                                <Sparkles className="w-5 h-5" />
                                {isEn ? 'Start 9-Day Journey' : 'Iniciar Jornada de 9 Dias'}
                            </button>
                        </div>
                    </div>
                ) : progress.is_complete ? (
                    // --- COMPLETED SCREEN ---
                    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 rounded-3xl border border-indigo-500/30 p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-yellow-500/20"
                        >
                            <CheckCircle className="w-12 h-12 text-slate-900" />
                        </motion.div>
                        <h2 className="text-4xl font-serif text-white mb-4">{isEn ? 'Congratulations!' : 'Parabéns!'}</h2>
                        <p className="text-slate-300 max-w-lg mb-8 text-lg">
                            {isEn
                                ? <>You completed <strong>{novena.title}</strong>. May the graces of this prayer remain with you.</>
                                : <>Completaste a <strong>{novena.title}</strong>. Que as graças desta oração permaneçam contigo.</>}
                        </p>
                        <div className="flex flex-col gap-4 w-full max-w-xs">
                            <Link href={novenasPath} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors">
                                {isEn ? 'Back to Catalogue' : 'Voltar ao Catálogo'}
                            </Link>
                            <button onClick={resetNovena} className="w-full py-3 text-sm text-slate-500 hover:text-white transition-colors">
                                {isEn ? 'Restart Novena' : 'Reiniciar Novena'}
                            </button>
                        </div>
                    </div>
                ) : (
                    // --- PLAYER (ACTIVE DAY) ---
                    <div className="grid gap-8">
                        {/* Header & Progress */}
                        <div className="bg-slate-900 rounded-3xl border border-white/10 p-6 md:p-8 relative overflow-hidden">
                            <div className="flex items-start justify-between mb-6 relative z-10">
                                <div>
                                    <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                        {isEn ? 'In Progress' : 'Em Progresso'}
                                    </span>
                                    <h2 className="text-2xl md:text-3xl font-serif text-white line-clamp-1">{novena.title}</h2>
                                </div>
                                <div className="text-center bg-slate-950 p-3 rounded-xl border border-white/5 min-w-[80px]">
                                    <span className="block text-2xl font-bold text-white">{progress.current_day} <span className="text-sm text-slate-500 font-normal">/ 9</span></span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{isEn ? 'Day' : 'Dia'}</span>
                                </div>
                            </div>

                            {/* Bar */}
                            <div className="w-full bg-slate-800 rounded-full h-2 relative z-10">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(progress.current_day / 9) * 100}%` }}
                                    transition={{ duration: 1 }}
                                    className="bg-indigo-500 h-full rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                />
                            </div>
                        </div>

                        {/* Content Card */}
                        <div className="bg-slate-950/50 rounded-3xl p-6 md:p-10 border border-white/5 shadow-2xl">
                            {currentDayData ? (
                                <motion.div
                                    key={currentDayData.day_number}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
                                            {currentDayData.day_number}
                                        </div>
                                        <h3 className="text-2xl font-serif text-white">{currentDayData.theme}</h3>
                                    </div>

                                    <div className="space-y-8 text-slate-300 leading-relaxed font-light text-lg">
                                        {/* Intro Prayer */}
                                        {novena.prayer_intro && (
                                            <div className="p-6 bg-indigo-900/10 rounded-2xl border-l-4 border-indigo-500/30 italic text-base text-slate-400">
                                                <p className="font-bold text-indigo-400 text-xs uppercase mb-2">{isEn ? 'Opening Prayer' : 'Oração Inicial'}</p>
                                                {novena.prayer_intro}
                                            </div>
                                        )}

                                        {/* Daily Content */}
                                        <div className="prose prose-invert max-w-none">
                                            <p className="whitespace-pre-line">{currentDayData.content}</p>
                                        </div>

                                        {/* Final Prayer */}
                                        {novena.prayer_final && (
                                            <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 italic text-base text-slate-400">
                                                <p className="font-bold text-slate-500 text-xs uppercase mb-2">{isEn ? 'Closing Prayer' : 'Oração Final'}</p>
                                                {novena.prayer_final}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 italic pt-4">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            {isEn ? 'Pray: 1 Our Father, 1 Hail Mary, 1 Glory Be.' : 'Rezar: 1 Pai Nosso, 1 Ave Maria, 1 Glória.'}
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/10 my-8" />

                                    <button
                                        onClick={completeDay}
                                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-3 text-lg group hover:scale-[1.02]"
                                    >
                                        {progress.current_day === 9 ? (
                                            <>{isEn ? 'Complete Novena' : 'Concluir Novena'} <Sparkles className="w-6 h-6" /></>
                                        ) : (
                                            <>{isEn ? `Complete Day ${progress.current_day}` : `Concluir Dia ${progress.current_day}`} <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" /></>
                                        )}
                                    </button>

                                    <div className="mt-6 text-center">
                                        <button onClick={resetNovena} className="text-xs text-red-400/40 hover:text-red-400 transition-colors uppercase tracking-widest font-bold">
                                            {isEn ? 'Restart from Scratch' : 'Reiniciar do Zero'}
                                        </button>
                                    </div>

                                </motion.div>
                            ) : (
                                <div className="text-center py-20 text-slate-500">
                                    {isEn ? 'Content not found for this day.' : 'Conteúdo não encontrado para este dia.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Quote Modal */}
                <AnimatePresence>
                    {completedDayQuote && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                                onClick={() => setCompletedDayQuote(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative bg-slate-900 border border-white/10 rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl z-50"
                            >
                                <button className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white" onClick={() => setCompletedDayQuote(null)}>
                                    <X className="w-6 h-6" />
                                </button>

                                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-indigo-500/20">
                                    <Sparkles className="w-10 h-10 text-indigo-500" />
                                </div>

                                <h3 className="text-3xl font-serif text-white mb-6">{isEn ? 'Message of Faith' : 'Mensagem de Fé'}</h3>
                                <blockquote className="text-xl text-slate-300 italic mb-10 leading-relaxed font-light">
                                    "{completedDayQuote}"
                                </blockquote>

                                <button
                                    onClick={() => setCompletedDayQuote(null)}
                                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors w-full text-lg"
                                >
                                    {isEn ? 'Amen' : 'Amém'} 🙏
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </VIPLayout>
    );
}
