"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Award, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

type Props = {
    dayCompleted: number;   // the day number just finished (1..9)
    isFinalDay: boolean;
    quote: string;          // faith message to show
    isEn: boolean;
    onClose: () => void;    // dismiss (e.g. backdrop) — stays on page
    onConfirm: () => void;  // "Amém" — proceeds (redirects to hub)
};

// Count-up animation for the streak number (gentle, ~0.7s)
function useCountUp(target: number, run: boolean) {
    const [value, setValue] = useState(run ? 0 : target);
    useEffect(() => {
        if (!run) { setValue(target); return; }
        if (target <= 0) { setValue(0); return; }
        let frame = 0;
        const steps = Math.min(target, 9);
        const interval = setInterval(() => {
            frame += 1;
            setValue(Math.round((frame / steps) * target));
            if (frame >= steps) clearInterval(interval);
        }, 90);
        return () => clearInterval(interval);
    }, [target, run]);
    return value;
}

export default function NovenaDayComplete({ dayCompleted, isFinalDay, quote, isEn, onClose, onConfirm }: Props) {
    const reduce = useReducedMotion();
    const shown = useCountUp(dayCompleted, !reduce && !isFinalDay);
    const nextDay = dayCompleted + 1;

    // A gentle golden confetti for each completed day (the final day already
    // fired its larger burst on completion).
    useEffect(() => {
        if (isFinalDay || reduce) return;
        const t = setTimeout(() => {
            confetti({
                particleCount: 60,
                spread: 70,
                startVelocity: 28,
                origin: { y: 0.35 },
                colors: ['#FFD700', '#F59E0B', '#FFFFFF'],
                zIndex: 3000,
            });
        }, 150);
        return () => clearTimeout(t);
    }, [isFinalDay, reduce]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                onClick={onClose}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="relative w-full max-w-md rounded-3xl border border-amber-500/20 bg-slate-900 p-8 md:p-10 text-center shadow-2xl overflow-hidden"
            >
                {/* Soft golden glow */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_55%_at_50%_0%,rgba(251,191,36,0.14),transparent_65%)]" />

                <div className="relative">
                    {/* Emblem */}
                    <div className="relative mx-auto mb-6 w-24 h-24">
                        {!reduce && (
                            <motion.span
                                className="absolute inset-0 rounded-full bg-amber-500/20"
                                initial={{ scale: 0.8, opacity: 0.7 }}
                                animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.7, 0, 0.7] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        )}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.05 }}
                            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.4)]"
                        >
                            {isFinalDay
                                ? <Award className="w-11 h-11 text-slate-950" />
                                : (
                                    <div className="flex flex-col items-center leading-none">
                                        <Flame className="w-5 h-5 text-slate-950/80 -mb-1" />
                                        <span className="text-3xl font-bold text-slate-950">{shown}</span>
                                    </div>
                                )}
                        </motion.div>
                    </div>

                    {isFinalDay ? (
                        <>
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                                {isEn ? 'Novena Complete' : 'Novena Concluída'}
                            </p>
                            <h3 className="font-serif text-3xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 mb-4">
                                {isEn ? 'You made it!' : 'Você chegou ao fim!'}
                            </h3>
                            <p className="text-slate-300 leading-relaxed mb-6">
                                {isEn
                                    ? 'You prayed all nine days of this novena. May its graces remain with you and those you love.'
                                    : 'Você completou os nove dias desta novena. Que as graças desta oração permaneçam com você e com quem você ama.'}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                                {isEn ? `${dayCompleted} ${dayCompleted === 1 ? 'day of prayer' : 'days of prayer'}` : `${dayCompleted} ${dayCompleted === 1 ? 'dia de oração' : 'dias de oração'}`}
                            </p>
                            <h3 className="font-serif text-3xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 mb-4">
                                {isEn ? `Day ${dayCompleted} complete!` : `Dia ${dayCompleted} concluído!`}
                            </h3>
                        </>
                    )}

                    {/* Faith message */}
                    {quote && (
                        <blockquote className="text-slate-300 italic leading-relaxed font-light mb-6 px-2">
                            “{quote}”
                        </blockquote>
                    )}

                    {/* Come-back-tomorrow nudge (not on the final day) */}
                    {!isFinalDay && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 mb-6 flex items-start gap-3 text-left">
                            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {isEn
                                    ? <>Come back <span className="font-semibold text-white">tomorrow</span> to pray Day {nextDay} and keep your prayer streak alive.</>
                                    : <>Volte <span className="font-semibold text-white">amanhã</span> para rezar o Dia {nextDay} e manter sua sequência de oração viva.</>}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={onConfirm}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition-all shadow-[0_0_24px_rgba(251,191,36,0.3)] text-lg"
                    >
                        {isEn ? 'Amen' : 'Amém'} 🙏
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
