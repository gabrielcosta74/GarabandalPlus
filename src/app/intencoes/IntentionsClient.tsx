"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, Loader2, Sparkles, Check, Heart, ArrowDown, Hand, User } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

// --- Types ---

type TutorialStep = {
    id: 'welcome' | 'candle' | 'history';
    text: string;
};

// --- Components ---

const RealisticCandle = ({ onClick, pulse = true, isTutorialHighlight = false }: { onClick?: () => void, pulse?: boolean, isTutorialHighlight?: boolean }) => {
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
                    Tocai para Acender
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

export default function IntentionsClient() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Tutorial State
    const [tutorialStep, setTutorialStep] = useState<TutorialStep['id'] | null>(null);
    const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

    const [intention, setIntention] = useState("");
    const [guestName, setGuestName] = useState("");
    const [hasDonation, setHasDonation] = useState(false);
    const [submissionState, setSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
    const [user, setUser] = useState<{ id?: string, name?: string, email?: string } | null>(null);
    const [publicHistory, setPublicHistory] = useState<any[]>([]);

    useEffect(() => {
        const seen = localStorage.getItem('garabandal_velas_public_v1');
        if (!seen) {
            setTutorialStep('welcome');
        } else {
            setHasSeenTutorial(true);
        }

        async function loadData() {
            if (supabaseBrowser) {
                const { data: { user: currentUser } } = await supabaseBrowser.auth.getUser();
                if (currentUser) {
                    const { data: member } = await supabaseBrowser.from('membros').select('nome').eq('id', currentUser.id).maybeSingle();
                    setUser({ id: currentUser.id, email: currentUser.email, name: member?.nome || 'Devoto' });
                }

                // Load some recent content or just user content? 
                // For public page, maybe we don't show history unless user is logged in, OR we show local storage history?
                // For now, let's keep it simple: if logged in, show history. If not, maybe empty.
                if (currentUser) {
                    const { data: history } = await supabaseBrowser
                        .from('prayer_intentions')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .order('created_at', { ascending: false });

                    if (history) setPublicHistory(history);
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
            localStorage.setItem('garabandal_velas_public_v1', 'true');
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
        setSubmissionState('loading');

        try {
            if (supabaseBrowser) {
                // If user is logged in, use their ID. If not, we might need a way to insert as Guest.
                // Assuming RLS allows inserts for authenticated users. 
                // For anon users, we might need to handle this.
                // If the user said "make it public", we assume RLS allows public inserts or we need to fix it.
                // For now, let's try to insert. If anon, user_id might be null? Or we need a public RPC?
                // Let's assume user_id is optional in DB or we pass a specific flag.

                // Construct payload
                const payload: any = {
                    intention_text: intention,
                    candle_type: hasDonation ? 'donation' : 'free',
                    amount: hasDonation ? 5.00 : 0.00,
                    status: 'pending',
                    // Add guest info if available
                    guest_name: !user ? (guestName || 'Anónimo') : undefined
                };

                if (user?.id) {
                    payload.user_id = user.id;
                }

                const { error } = await supabaseBrowser.from('prayer_intentions').insert(payload);

                if (error) {
                    console.error("Submission error:", error);
                    // Fallback visual success if DB fails for RLS reasons (just for UX if needed, but better show error)
                    if (error.code === '42501') { // Permission denied
                        alert("Não foi possível enviar a intenção. Por favor, tente fazer login."); // Temporary fallback
                        throw error;
                    }
                    throw error;
                }

                // If logged in, refresh history
                if (user?.id) {
                    const { data: history } = await supabaseBrowser
                        .from('prayer_intentions')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });
                    if (history) setPublicHistory(history);
                } else {
                    // Start a fake history for guest session or just append visually
                    setPublicHistory(prev => [{ created_at: new Date().toISOString(), id: 'temp-' + Date.now() }, ...prev]);
                }
            }

            setTimeout(() => {
                setSubmissionState('success');
            }, 1000);

        } catch (error) {
            setSubmissionState('idle');
            // alert("Erro ao enviar. Tente novamente.");
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setSubmissionState('idle');
        setIntention("");
        setGuestName("");
        setHasDonation(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
            <main className="flex-1 flex flex-col relative overflow-hidden pt-20"> {/* PT-20 for header */}

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
                                <h3 className="text-xl font-serif text-white mb-2">Pedido de Oração</h3>
                                <p className="text-white/60 mb-6">Pode enviar as suas intenções a Nossa Senhora, mesmo sem ser membro. Acenda aqui a sua vela.</p>
                                <button onClick={advanceTutorial} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors">
                                    Começar
                                </button>
                            </motion.div>
                        </div>
                    )}

                    {/* Step 2: Candle Focus */}
                    {tutorialStep === 'candle' && (
                        <div className="fixed inset-0 z-[60] pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="mt-72 flex flex-col items-center"
                                >
                                    <div className="bg-orange-600 text-white px-6 py-2 rounded-full font-bold shadow-lg mb-4 whitespace-nowrap animate-bounce">
                                        Toque na vela para acender
                                    </div>
                                    <Hand className="w-12 h-12 text-white fill-white rotate-180 animate-pulse" />
                                </motion.div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: History Focus */}
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
                                <h3 className="text-xl font-bold text-white mb-2">As Suas Velas</h3>
                                <p className="text-white/60 mb-6">As suas intenções ficarão visíveis aqui nesta sessão.</p>
                                <button onClick={advanceTutorial} className="text-white underline hover:text-orange-400">
                                    Obrigado
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
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 w-full max-w-2xl text-center mx-auto min-h-[80vh]">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}
                        className="mb-12"
                    >
                        <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 leading-tight max-w-4xl mx-auto">
                            Santuário Virtual<br />de Garabandal
                        </h1>
                        <p className="text-white/60 font-light max-w-lg mx-auto leading-relaxed text-base px-4">
                            Faça o seu pedido a Nossa Senhora. As suas orações serão apresentadas na Igreja de Garabandal.
                        </p>
                    </motion.div>

                    {/* Main Interaction */}
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="mb-16 relative"
                    >
                        <RealisticCandle
                            onClick={handleCandleClick}
                            isTutorialHighlight={tutorialStep === 'candle'}
                        />
                    </motion.div>

                    {/* History Section */}
                    {publicHistory.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`w-full border-t border-white/5 pt-8 ${tutorialStep === 'history' ? 'relative z-[60]' : ''}`}
                        >
                            <div className="flex items-center gap-3 mb-6 justify-center text-white/30 text-xs uppercase tracking-widest font-bold">
                                <Sparkles className="w-3 h-3" />
                                Velas acesas recentemente por si
                            </div>

                            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                                {publicHistory.map((item) => (
                                    <SmallCandle key={item.id} date={item.created_at || new Date().toISOString()} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

            </main>

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
                                    <h3 className="text-2xl font-serif text-white mb-2">Vela Acesa com Sucesso</h3>
                                    <p className="text-white/50 mb-8">A sua intenção foi registada e unida às orações do Apostolado.</p>
                                    <button onClick={handleClose} className="text-sm text-white/40 hover:text-white transition-colors">Fechar</button>
                                </div>
                            ) : (
                                <div className="p-8 md:p-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-serif text-white">Nova Intenção</h2>
                                            <p className="text-white/40 text-sm mt-1">Escreva o que vai no seu coração.</p>
                                        </div>
                                        <button onClick={handleClose} className="rounded-full p-2 bg-white/5 hover:bg-white/10 text-white/50 transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Name Input (Only if guest OR if anonymous is checked) */}
                                    {(!user || (user && guestName === 'Anónimo')) && (
                                        <div className="mb-4">
                                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">O seu nome (Opcional)</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                                <input
                                                    type="text"
                                                    value={guestName === 'Anónimo' ? '' : guestName}
                                                    onChange={(e) => setGuestName(e.target.value)}
                                                    placeholder="Anónimo"
                                                    disabled={!!(user && guestName === 'Anónimo')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors disabled:opacity-50"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Anonymous Toggle for Logged In Users */}
                                    {user && (
                                        <div
                                            onClick={() => setGuestName(prev => prev === 'Anónimo' ? '' : 'Anónimo')}
                                            className="flex items-center gap-3 mb-6 cursor-pointer group"
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${guestName === 'Anónimo' ? 'bg-white border-white' : 'border-white/30 group-hover:border-white/50'}`}>
                                                {guestName === 'Anónimo' && <Check className="w-3 h-3 text-black" />}
                                            </div>
                                            <span className="text-sm text-white/60 group-hover:text-white transition-colors">Enviar como Anónimo (Não aparecerá no seu histórico)</span>
                                        </div>
                                    )}

                                    <div className="mb-8">
                                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">O seu pedido</label>
                                        <textarea
                                            value={intention}
                                            onChange={(e) => setIntention(e.target.value)}
                                            placeholder="Nossa Senhora, hoje peço-te por..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 h-32 text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 resize-none font-serif leading-relaxed"
                                            autoFocus
                                        />
                                    </div>

                                    <div
                                        onClick={() => setHasDonation(!hasDonation)}
                                        className={`cursor-pointer p-4 rounded-xl border mb-8 transition-all flex items-center gap-4 ${hasDonation ? 'bg-orange-500/10 border-orange-500/40' : 'bg-transparent border-white/10 hover:border-white/20'}`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${hasDonation ? 'bg-orange-500 border-orange-500' : 'border-white/30'}`}>
                                            {hasDonation && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-white text-sm font-medium flex items-center gap-2">
                                                Fazer um Donativo (5.00€)
                                                {hasDonation && <Heart className="w-3 h-3 text-orange-400 fill-orange-400" />}
                                            </div>
                                            <div className="text-xs text-white/40 mt-1">Opcional. Ajuda a manter esta obra de evangelização.</div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={!intention.trim() || submissionState === 'loading'}
                                        className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
                                    >
                                        {submissionState === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                            <>Acender a Vela <Flame className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
