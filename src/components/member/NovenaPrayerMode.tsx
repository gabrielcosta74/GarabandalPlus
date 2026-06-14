"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ChevronRight, ArrowLeft, Sparkles, ChevronLeft } from 'lucide-react';

// --- Prayer sequence (configurable repetitions per novena / per day) ---
export type PrayerType = 'ourFather' | 'hailMary' | 'gloryBe';
export type PrayerSeqItem = { type: PrayerType; count: number };
export type PrayerSequence = PrayerSeqItem[];

export const DEFAULT_SEQUENCE: PrayerSequence = [
    { type: 'ourFather', count: 1 },
    { type: 'hailMary', count: 1 },
    { type: 'gloryBe', count: 1 },
];

type DayData = {
    day_number: number;
    theme: string;
    content: string;
    prayer_sequence?: PrayerSequence | null;
};

type NovenaLite = {
    id: string;
    title: string;
    prayer_intro?: string | null;
    prayer_final?: string | null;
    prayer_sequence?: PrayerSequence | null;
};

type Props = {
    novena: NovenaLite;
    dayData: DayData;
    isEn: boolean;
    isFinalDay: boolean;
    completing?: boolean;
    onComplete: () => void;
    onClose: () => void;
};

type Step = { id: string; kicker: string; title: string; body: string; count: number };

// Traditional Catholic prayers (fixed text, PT/EN)
const FIXED_PRAYERS = {
    ourFather: {
        pt: `Pai nosso que estais nos céus,
santificado seja o vosso nome;
venha a nós o vosso reino;
seja feita a vossa vontade
assim na terra como no céu.
O pão nosso de cada dia nos dai hoje;
perdoai-nos as nossas ofensas
assim como nós perdoamos a quem nos tem ofendido;
e não nos deixeis cair em tentação,
mas livrai-nos do mal.
Amém.`,
        en: `Our Father, who art in heaven,
hallowed be thy name;
thy kingdom come;
thy will be done
on earth as it is in heaven.
Give us this day our daily bread;
and forgive us our trespasses,
as we forgive those who trespass against us;
and lead us not into temptation,
but deliver us from evil.
Amen.`,
    },
    hailMary: {
        pt: `Ave Maria, cheia de graça,
o Senhor é convosco;
bendita sois vós entre as mulheres,
e bendito é o fruto do vosso ventre, Jesus.
Santa Maria, Mãe de Deus,
rogai por nós, pecadores,
agora e na hora da nossa morte.
Amém.`,
        en: `Hail Mary, full of grace,
the Lord is with thee;
blessed art thou amongst women,
and blessed is the fruit of thy womb, Jesus.
Holy Mary, Mother of God,
pray for us sinners,
now and at the hour of our death.
Amen.`,
    },
    gloryBe: {
        pt: `Glória ao Pai, ao Filho
e ao Espírito Santo.
Como era no princípio,
agora e sempre.
Amém.`,
        en: `Glory be to the Father,
and to the Son,
and to the Holy Spirit.
As it was in the beginning,
is now, and ever shall be,
world without end.
Amen.`,
    },
};

const PRAYER_META: Record<PrayerType, { pt: string; en: string; pluralPt: string; pluralEn: string; body: { pt: string; en: string } }> = {
    ourFather: { pt: 'Pai Nosso', en: 'Our Father', pluralPt: 'Pai Nossos', pluralEn: 'Our Fathers', body: FIXED_PRAYERS.ourFather },
    hailMary: { pt: 'Ave Maria', en: 'Hail Mary', pluralPt: 'Ave Marias', pluralEn: 'Hail Marys', body: FIXED_PRAYERS.hailMary },
    gloryBe: { pt: 'Glória', en: 'Glory Be', pluralPt: 'Glórias', pluralEn: 'Glory Bes', body: FIXED_PRAYERS.gloryBe },
};

// Defensive: accept arbitrary jsonb and normalise into a valid sequence.
function sanitizeSequence(raw: unknown): PrayerSequence {
    if (!Array.isArray(raw)) return DEFAULT_SEQUENCE;
    const cleaned = raw
        .filter((x): x is { type: string; count?: unknown } =>
            !!x && typeof x === 'object' && typeof (x as { type?: unknown }).type === 'string' && (x as { type: string }).type in PRAYER_META)
        .map(x => ({
            type: x.type as PrayerType,
            count: Math.max(1, Math.floor(Number((x as { count?: unknown }).count)) || 1),
        }));
    return cleaned.length ? cleaned : DEFAULT_SEQUENCE;
}

// Human-readable summary, e.g. "Pai Nosso, 10 Ave Marias, Glória".
export function prayerSummary(seq: PrayerSequence | null | undefined, isEn: boolean): string {
    return sanitizeSequence(seq ?? DEFAULT_SEQUENCE)
        .map(item => {
            const meta = PRAYER_META[item.type];
            if (item.count > 1) return `${item.count} ${isEn ? meta.pluralEn : meta.pluralPt}`;
            return isEn ? meta.en : meta.pt;
        })
        .join(', ');
}

const buzz = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(8); } catch { /* no-op */ }
    }
};

export default function NovenaPrayerMode({ novena, dayData, isEn, isFinalDay, completing, onComplete, onClose }: Props) {
    const reduce = useReducedMotion();

    const steps = useMemo<Step[]>(() => {
        const s: Step[] = [];
        if (novena.prayer_intro) {
            s.push({ id: 'opening', kicker: isEn ? 'Opening Prayer' : 'Oração Inicial', title: isEn ? 'Let us begin' : 'Comecemos', body: novena.prayer_intro, count: 1 });
        }
        s.push({ id: 'meditation', kicker: isEn ? `Day ${dayData.day_number} · Meditation` : `Dia ${dayData.day_number} · Meditação`, title: dayData.theme, body: dayData.content, count: 1 });

        const seq = sanitizeSequence(dayData.prayer_sequence ?? novena.prayer_sequence ?? DEFAULT_SEQUENCE);
        seq.forEach((item, i) => {
            const meta = PRAYER_META[item.type];
            s.push({
                id: `${item.type}-${i}`,
                kicker: isEn ? 'Pray' : 'Reza',
                title: isEn ? meta.en : meta.pt,
                body: isEn ? meta.body.en : meta.body.pt,
                count: item.count,
            });
        });

        if (novena.prayer_final) {
            s.push({ id: 'closing', kicker: isEn ? 'Closing Prayer' : 'Oração Final', title: isEn ? 'To finish' : 'Para terminar', body: novena.prayer_final, count: 1 });
        }
        return s;
    }, [novena.prayer_intro, novena.prayer_final, novena.prayer_sequence, dayData.day_number, dayData.theme, dayData.content, dayData.prayer_sequence, isEn]);

    const storageKey = `novena-step-${novena.id}-day-${dayData.day_number}`;
    const [index, setIndex] = useState(0);
    const [rep, setRep] = useState(1);
    const [dir, setDir] = useState(1);

    // Resume within the day (session only) — stored as "index:rep"
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved != null) {
                const [iRaw, rRaw] = saved.split(':');
                const i = parseInt(iRaw, 10);
                if (!Number.isNaN(i)) {
                    const clampedI = Math.min(Math.max(i, 0), steps.length - 1);
                    setIndex(clampedI);
                    const maxRep = steps[clampedI]?.count ?? 1;
                    const r = parseInt(rRaw ?? '1', 10);
                    setRep(Number.isNaN(r) ? 1 : Math.min(Math.max(r, 1), maxRep));
                }
            }
        } catch { /* no-op */ }
    }, [storageKey, steps]);

    useEffect(() => {
        try { sessionStorage.setItem(storageKey, `${index}:${rep}`); } catch { /* no-op */ }
    }, [index, rep, storageKey]);

    const isLast = index === steps.length - 1;
    const step = steps[index];
    const currentCount = step?.count ?? 1;
    const atEndOfStep = rep >= currentCount;
    const showComplete = isLast && atEndOfStep;

    const goNext = useCallback(() => {
        buzz();
        const count = steps[index]?.count ?? 1;
        if (rep < count) {
            setDir(1);
            setRep(r => r + 1);
            return;
        }
        if (index === steps.length - 1) {
            try { sessionStorage.removeItem(storageKey); } catch { /* no-op */ }
            onComplete();
            return;
        }
        setDir(1);
        setIndex(i => Math.min(i + 1, steps.length - 1));
        setRep(1);
    }, [index, rep, onComplete, steps, storageKey]);

    const goPrev = useCallback(() => {
        if (rep > 1) {
            buzz();
            setDir(-1);
            setRep(r => r - 1);
            return;
        }
        if (index === 0) return;
        buzz();
        setDir(-1);
        const prevIdx = index - 1;
        setIndex(prevIdx);
        setRep(steps[prevIdx]?.count ?? 1);
    }, [index, rep, steps]);

    // Keyboard: Esc to close, arrows to navigate
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, goNext, goPrev]);

    const offset = reduce ? 0 : 40;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col"
        >
            {/* Opaque base + soft golden candlelight glow (decorative, over opaque bg) */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_0%,rgba(251,191,36,0.10),transparent_60%)]" />

            {/* Top bar: progress + close */}
            <div className="relative shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
                <div className="flex-1 flex items-center gap-1.5">
                    {steps.map((s, i) => {
                        const fill = i < index ? 1 : i > index ? 0 : (currentCount > 0 ? rep / currentCount : 1);
                        return (
                            <span key={s.id} className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                                <span
                                    className="block h-full rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-all duration-300"
                                    style={{ width: `${fill * 100}%` }}
                                />
                            </span>
                        );
                    })}
                </div>
                <span className="text-[11px] uppercase tracking-wider text-amber-400/90 font-bold shrink-0">
                    {isEn ? `Day ${dayData.day_number}` : `Dia ${dayData.day_number}`}
                </span>
                <button
                    onClick={onClose}
                    className="shrink-0 p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
                    aria-label={isEn ? 'Close' : 'Fechar'}
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Step content */}
            <div className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center px-6">
                <AnimatePresence mode="wait" custom={dir}>
                    <motion.div
                        key={`${step.id}-${rep}`}
                        custom={dir}
                        initial={{ opacity: 0, x: dir * offset }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: dir * -offset }}
                        transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
                        drag={reduce ? false : 'x'}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.12}
                        onDragEnd={(_, info) => {
                            if (info.offset.x < -80) goNext();
                            else if (info.offset.x > 80) goPrev();
                        }}
                        className="w-full max-w-xl text-center cursor-grab active:cursor-grabbing"
                    >
                        <p className="text-amber-400 text-xs md:text-sm font-bold uppercase tracking-widest mb-3">
                            {step.kicker}
                        </p>
                        <span className="block w-10 h-px mx-auto mb-5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                        <h2 className="font-serif text-3xl md:text-4xl mb-5 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200">
                            {step.title}
                        </h2>

                        {/* Repetition counter (only when a prayer repeats) */}
                        {currentCount > 1 && (
                            <div className="mb-6 flex flex-col items-center gap-2.5">
                                <p className="text-amber-300/90 text-sm font-bold tracking-wide">
                                    {isEn ? `${rep} of ${currentCount}` : `${rep} de ${currentCount}`}
                                </p>
                                <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-[260px]">
                                    {Array.from({ length: currentCount }).map((_, i) => (
                                        <span
                                            key={i}
                                            className={`w-2 h-2 rounded-full transition-colors duration-200 ${i < rep ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'bg-white/15'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="max-h-[48vh] overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <p className="text-slate-200 text-lg md:text-xl leading-relaxed md:leading-relaxed whitespace-pre-line font-light">
                                {step.body}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div className="relative shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={goNext}
                        disabled={completing}
                        className="w-full py-4 md:py-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] disabled:opacity-60 text-slate-950 font-bold rounded-2xl transition-all shadow-[0_0_24px_rgba(251,191,36,0.30)] flex items-center justify-center gap-2.5 text-lg"
                    >
                        {showComplete ? (
                            <>
                                {completing
                                    ? (isEn ? 'Saving…' : 'A guardar…')
                                    : (isFinalDay ? (isEn ? 'Complete Novena' : 'Concluir Novena') : (isEn ? 'Complete Day' : 'Concluir Dia'))}
                                <Sparkles className="w-5 h-5" />
                            </>
                        ) : currentCount > 1 && !atEndOfStep ? (
                            <>
                                {isEn ? 'Next' : 'Seguinte'}
                                <ChevronRight className="w-5 h-5" />
                            </>
                        ) : (
                            <>
                                {isEn ? 'Continue' : 'Continuar'}
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    <div className="mt-3 flex items-center justify-between text-slate-500">
                        <button
                            onClick={goPrev}
                            disabled={index === 0 && rep === 1}
                            className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-0 hover:text-slate-300 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            {isEn ? 'Back' : 'Anterior'}
                        </button>
                        <span className="text-[11px] tracking-wide">
                            {index + 1} / {steps.length}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            {isEn ? 'swipe' : 'deslizar'} <ArrowLeft className="w-3 h-3 rotate-180" />
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
