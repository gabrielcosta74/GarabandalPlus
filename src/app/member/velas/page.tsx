"use client";

import { useState, useEffect, useRef } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, Loader2, Sparkles, ArrowDown, Hand } from 'lucide-react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useLocale } from '../../../contexts/LocaleContext';

// --- Types ---

type TutorialStep = {
    id: 'welcome' | 'candle' | 'history';
    text: string;
};

// --- Components ---

const RealisticCandle = ({ onClick, pulse = true, isTutorialHighlight = false }: { onClick?: () => void, pulse?: boolean, isTutorialHighlight?: boolean }) => {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    return (
        <div
            onClick={onClick}
            className={`relative group cursor-pointer transition-all duration-700 ${isTutorialHighlight ? 'z-[60] scale-110' : 'z-10'} ${onClick ? 'active:scale-95' : ''}`}
        >
            {/* Ambient Light (Glow) */}
            <motion.div
                animate={{ opacity: [0.6, 0.7, 0.6], scale: [1, 1.02, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none"
            />

            <div className="relative flex flex-col items-center">
                {/* FLAME CONTAINER */}
                <div className="relative w-20 h-32 mb-[-10px] flex justify-center items-end z-20">

                    {/* Outer Glow Halo */}
                    <motion.div
                        animate={{ opacity: [0.2, 0.3, 0.2], scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse" }}
                        className="absolute bottom-4 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl"
                    />

                    {/* The Flame Itself */}
                    <motion.div
                        animate={pulse ? {
                            scaleY: [1, 1.1, 0.95, 1.05, 1],
                            scaleX: [1, 0.95, 1.05, 0.98, 1],
                            rotate: [0, -2, 2, -1, 0],
                        } : {}}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", times: [0, 0.2, 0.5, 0.8, 1] }}
                        className="relative origin-bottom"
                    >
                        {/* Core (White/Blue hot center) */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-10 bg-white rounded-full blur-[1px] z-30" />
                        {/* Inner (Yellow main body) */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-20 bg-gradient-to-t from-orange-300 via-yellow-200 to-white rounded-[50%] opacity-90 blur-[2px] z-20" />
                        {/* Outer (Orange tint) */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-24 bg-gradient-to-t from-red-500/50 via-orange-500/50 to-transparent rounded-[50%] blur-[8px] z-10" />
                    </motion.div>
                </div>

                {/* WICK */}
                <div className="w-1.5 h-4 bg-gradient-to-t from-gray-900 to-gray-600 rounded-sm relative z-10 mb-[-2px]" />

                {/* WAX BODY */}
                <div className="relative w-32 h-56 bg-[#fdfbf7] rounded-lg shadow-2xl overflow-hidden z-0">
                    {/* Wax Gradient (simulating subsurface scattering) */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#eaddcf] to-[#d4c5b5]" />

                    {/* Top Curve (Concave) */}
                    <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-[#fff9f0] to-[#e6dccf] rounded-[50%] shadow-inner transform -translate-y-1/2 scale-x-110" />

                    {/* Melted Drips */}
                    <div className="absolute top-3 left-4 w-3 h-24 bg-[#fdfbf7] rounded-full opacity-90 shadow-sm" />
                    <div className="absolute top-5 right-8 w-2 h-16 bg-[#fdfbf7] rounded-full opacity-80 shadow-sm" />
                    <div className="absolute top-4 left-10 w-2 h-10 bg-[#fdfbf7] rounded-full opacity-70" />

                    {/* Shadow Overlay for volume */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20 pointer-events-none" />
                </div>
            </div>

            {onClick && !isTutorialHighlight && (
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-orange-200/80 text-sm font-medium tracking-widest uppercase">
                    {isEn ? 'Tap to Light' : 'Tocai para Acender'}
                </div>
            )}
        </div>
    );
};

const SmallCandle = ({ date }: { date: string }) => (
    <div className="flex flex-col items-center gap-3 group">
        <div className="relative w-8 h-20">
            {/* Flame */}
            <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1 + Math.random(), repeat: Infinity }}
                className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-t from-orange-500 via-yellow-300 to-white rounded-full blur-[2px] shadow-[0_0_15px_rgba(255,165,0,0.6)]"
            />
            {/* Body */}
            <div className="w-8 h-full bg-gradient-to-b from-[#fdfbf7] to-[#d4c5b5] rounded-sm shadow-lg relative overflow-hidden">
                <div className="absolute top-0 w-full h-2 bg-white/50 rounded-full blur-[1px]" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10" />
            </div>
        </div>
        <span className="text-[10px] text-slate-500 font-mono opacity-40 group-hover:opacity-100 transition-opacity">
            {new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
        </span>
    </div>
);

// --- Main Page ---

export default function IntentionsPage() {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Tutorial State
    const [tutorialStep, setTutorialStep] = useState<TutorialStep['id'] | null>(null);
    const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

    const [intention, setIntention] = useState("");
    const [submissionState, setSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
    const [user, setUser] = useState<{ id: string, name: string } | null>(null);
    const [myHistory, setMyHistory] = useState<any[]>([]);

    useEffect(() => {
        const seen = localStorage.getItem('garabandal_velas_tutorial_v2');
        if (!seen) {
            setTutorialStep('welcome');
        } else {
            setHasSeenTutorial(true);
        }

        async function loadData() {
            if (supabaseBrowser) {
                const { data: { user } } = await supabaseBrowser.auth.getUser();
                if (user) {
                    const { data: member } = await supabaseBrowser.from('membros').select('nome').eq('id', user.id).single();
                    setUser({ id: user.id, name: member?.nome || (isEn ? 'Devotee' : 'Devoto') });

                    const { data: history } = await supabaseBrowser
                        .from('prayer_intentions')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (history) setMyHistory(history);
                }
            }
        }
        loadData();
    }, []);

    // Tutorial Logic
    const advanceTutorial = () => {
        if (tutorialStep === 'welcome') setTutorialStep('candle');
        else if (tutorialStep === 'candle') {
            // This step is advanced by clicking the candle
        }
        else if (tutorialStep === 'history') {
            setTutorialStep(null);
            localStorage.setItem('garabandal_velas_tutorial_v2', 'true');
            setHasSeenTutorial(true);
        }
    };

    const handleCandleClick = () => {
        if (tutorialStep === 'candle') {
            setTutorialStep('history'); // Advance tutorial
        }
        setIsModalOpen(true); // Always open modal
    };

    const handleSubmit = async () => {
        if (!user) return;
        setSubmissionState('loading');

        try {
            if (supabaseBrowser) {
                const { error } = await supabaseBrowser.from('prayer_intentions').insert({
                    user_id: user.id,
                    intention_text: intention,
                    candle_type: 'free',
                    amount: 0.00,
                    status: 'pending'
                });

                if (error) throw error;

                const { data: history } = await supabaseBrowser
                    .from('prayer_intentions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                if (history) setMyHistory(history);
            }

            setTimeout(() => {
                setSubmissionState('success');
            }, 1000);

        } catch (error) {
            setSubmissionState('idle');
            alert(isEn ? "Error sending. Try again." : "Erro ao enviar. Tente novamente.");
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setSubmissionState('idle');
        setIntention("");
    };

    // Adjusted interactions:
    useEffect(() => {
        if (!isModalOpen && tutorialStep === 'history') {
            // Modal closed, now show history tip
        }
    }, [isModalOpen, tutorialStep]);

    return (
        <VIPLayout>
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center relative overflow-hidden text-slate-200">

                {/* --- Tutorial Overlay Backdrop --- */}
                <AnimatePresence>
                    {tutorialStep && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/80 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* --- Tutorial Elements (High Z-Index) --- */}
                <AnimatePresence>

                    {/* Step 1: Welcome Center */}
                    {tutorialStep === 'welcome' && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 pointer-events-auto">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.1, opacity: 0 }}
                                className="bg-[#1a1a1a] p-8 rounded-2xl border border-white/10 max-w-sm text-center shadow-2xl"
                            >
                                <Sparkles className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                                <h3 className="text-xl font-serif text-white mb-2">{isEn ? 'Interactive Tutorial' : 'Tutorial Interativo'}</h3>
                                <p className="text-white/60 mb-6">{isEn ? 'Welcome to the Sanctuary. We will teach you how to light your candles.' : 'Bem-vindo ao Santuário. Vamos ensinar-lhe como acender as suas velas.'}</p>
                                <button onClick={advanceTutorial} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors">
                                    {isEn ? 'Start' : 'Começar'}
                                </button>
                            </motion.div>
                        </div>
                    )}

                    {/* Step 2: Candle Focus (Action Driven) */}
                    {tutorialStep === 'candle' && (
                        <div className="fixed inset-0 z-[60] pointer-events-none">
                            {/* Positioning absolute relative to viewport is tricky without tracking ref, 
                                but since candle is centered in layout, we can center the tip here */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                {/* The Pointer Hand */}
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="mt-72 flex flex-col items-center"
                                >
                                    <div className="bg-orange-600 text-white px-6 py-2 rounded-full font-bold shadow-lg mb-4 whitespace-nowrap animate-bounce">
                                        {isEn ? 'Tap the candle' : 'Toque na vela'}
                                    </div>
                                    <Hand className="w-12 h-12 text-white fill-white rotate-180 animate-pulse" />
                                </motion.div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: History Focus (After Modal Close ideally, or just at bottom) */}
                    {tutorialStep === 'history' && (
                        <div className="fixed bottom-0 inset-x-0 z-[60] p-8 pointer-events-auto bg-gradient-to-t from-black via-black/90 to-transparent pt-32 flex flex-col items-center">
                            <motion.div
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-center max-w-md"
                            >
                                <div className="mx-auto bg-orange-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                    <ArrowDown className="w-8 h-8 text-orange-500 animate-bounce" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{isEn ? 'Your Candles' : 'As Suas Velas'}</h3>
                                <p className="text-white/60 mb-6">{isEn ? 'All your intentions will be saved down here forever.' : 'Todas as suas intenções ficarão guardadas aqui em baixo para sempre.'}</p>
                                <button onClick={advanceTutorial} className="text-white underline hover:text-orange-400">
                                    {isEn ? 'Got it, Thanks' : 'Entendi, Obrigado'}
                                </button>
                            </motion.div>
                        </div>
                    )}

                </AnimatePresence>


                {/* Background Ambient */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-900/10 rounded-full blur-[120px]" />
                </div>

                {/* Hero Section */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 w-full max-w-2xl text-center">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}
                        className="mb-12"
                    >
                        <h1 className="font-serif text-2xl md:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 leading-tight max-w-4xl mx-auto">
                            {isEn ? (
                                <>Send prayer request to<br className="hidden md:block" /> Our Lady of Mount Carmel of Garabandal</>
                            ) : (
                                <>Enviar pedido de oração a<br className="hidden md:block" /> Nossa Senhora do Carmo de Garabandal</>
                            )}
                        </h1>
                        <p className="text-white/60 font-light max-w-lg mx-auto leading-relaxed text-sm md:text-base px-4">
                            {isEn ? 'Your intentions are presented to Our Lady of Garabandal in the Garabandal church.' : 'As suas intenções são apresentadas a Nossa Senhora de Garabandal na igreja em Garabandal.'}
                        </p>
                    </motion.div>

                    {/* Main Interaction */}
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="mb-16 relative"
                    >
                        {/* NOTE: If tutorial step is candle, we pass isTutorialHighlight prop to z-index boost it above overlay */}
                        <RealisticCandle
                            onClick={handleCandleClick}
                            isTutorialHighlight={tutorialStep === 'candle'}
                        />
                    </motion.div>

                    {/* History Section */}
                    {myHistory.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`w-full border-t border-white/5 pt-8 ${tutorialStep === 'history' ? 'relative z-[60]' : ''}`}
                        >
                            <div className="flex items-center gap-3 mb-6 justify-center text-white/30 text-xs uppercase tracking-widest font-bold">
                                <Sparkles className="w-3 h-3" />
                                {isEn ? 'My candles' : 'As minhas velas'}
                            </div>

                            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                                {myHistory.map((item) => (
                                    <SmallCandle key={item.id} date={item.created_at} />
                                ))}
                            </div>
                        </motion.div>
                    )}

                </div>

                {/* --- Modal --- */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleClose}
                                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="relative bg-[#111] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                            >
                                {submissionState === 'success' ? (
                                    <div className="p-12 flex flex-col items-center text-center">
                                        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 text-green-500 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                            <Flame className="w-8 h-8 fill-green-500 animate-pulse" />
                                        </div>
                                        <h3 className="text-2xl font-serif text-white mb-2">{isEn ? 'Candle Lit' : 'Vela Acesa'}</h3>
                                        <p className="text-white/50 mb-8">{isEn ? 'Your intention went up to heaven and will be presented in Garabandal.' : 'A sua intenção subiu aos céus e será apresentada em Garabandal.'}</p>
                                        <button onClick={handleClose} className="text-sm text-white/40 hover:text-white transition-colors">{isEn ? 'Close this moment' : 'Fechar este momento'}</button>
                                    </div>
                                ) : (
                                    <div className="p-8 md:p-10">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <h2 className="text-2xl font-serif text-white">{isEn ? 'New Intention' : 'Nova Intenção'}</h2>
                                                <p className="text-white/40 text-sm mt-1">{isEn ? "Write what's on your soul today." : 'Escreva o que vai na sua alma hoje.'}</p>
                                            </div>
                                            <button onClick={handleClose} className="rounded-full p-2 bg-white/5 hover:bg-white/10 text-white/50 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <textarea
                                            value={intention}
                                            onChange={(e) => setIntention(e.target.value)}
                                            placeholder={isEn ? "My heavenly mother, today I ask you..." : "Minha mãe do céu, hoje peço-te..."}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 h-40 text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 resize-none mb-8 font-serif leading-relaxed"
                                            autoFocus
                                        />

                                        <button
                                            onClick={handleSubmit}
                                            disabled={!intention.trim() || submissionState === 'loading'}
                                            className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
                                        >
                                            {submissionState === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                                <>{isEn ? 'Light Candle' : 'Acender a Vela'} <Flame className="w-4 h-4" /></>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </VIPLayout>
    );
}
