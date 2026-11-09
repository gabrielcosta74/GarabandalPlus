"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import {
    motion,
    useMotionValue,
    useMotionValueEvent,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    easeInOut,
    type MotionValue,
} from 'framer-motion';
import RichText from '../RichText';
import { isRichTextEmpty, richTextToPlain } from '../../../lib/rich-text';
import { MaskText, Reveal } from './primitives';
import StopReader, { type ReaderStop } from './StopReader';
import type { CinemaItineraryItem } from './types';

/**
 * A cortina entre paragens segue o scroll (suavizado por uma mola), para a
 * pessoa controlar e ver a imagem seguinte a aparecer. O texto troca por tempo
 * a meio da cortina; HYSTERESIS evita que pisque perto desse ponto.
 */
const HYSTERESIS = 0.12;
/** Mola que suaviza o scroll (sem solavancos da roda do rato). */
const SCROLL_SPRING = { stiffness: 90, damping: 22, mass: 0.45 };
/** Quantas imagens à frente e atrás ficam montadas (as outras só carregam perto). */
const MOUNT_WINDOW = 3;

type Stop = ReaderStop & { excerpt: string; truncated: boolean };

const pad = (n: number) => String(n).padStart(2, '0');

/** Divide em frases sem partir em abreviaturas ("S.", "Pe.", "Sta.", "Nª."). */
function sentencesOf(text: string) {
    const out: string[] = [];
    let start = 0;
    const re = /[.!?…]+(?=\s+["“(]?[A-ZÀ-Ý0-9]|\s*$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const before = text.slice(start, m.index);
        const lastWord = before.split(/\s+/).pop() || '';
        // Palavra curta com maiúscula antes do ponto = abreviatura, não fim de frase.
        if (/^[A-ZÀ-Ý][a-zà-ÿª]{0,2}$/.test(lastWord)) continue;
        const end = m.index + m[0].length;
        out.push(text.slice(start, end).trim());
        start = end;
    }
    if (start < text.length && text.slice(start).trim()) out.push(text.slice(start).trim());
    return out;
}

const balanced = (text: string) => (text.match(/\(/g) || []).length === (text.match(/\)/g) || []).length;

/** Resumo que acaba numa frase completa (nunca corta a meio nem deixa parênteses abertos). */
function excerptOf(html: string, max: number) {
    // Limpa gralhas comuns do texto (",.", espaços antes de pontuação).
    const plain = richTextToPlain(html).replace(/,\s*\./g, '.').replace(/\s+([,.;:!?])/g, '$1');
    if (plain.length <= max) return { excerpt: plain, truncated: false };
    const sentences = sentencesOf(plain);
    let out = '';
    let best = '';
    for (const sentence of sentences) {
        const next = out ? `${out} ${sentence}` : sentence;
        if (next.length > max) break;
        out = next;
        if (balanced(out)) best = out;
    }
    if (best.length < 60) {
        // Primeira frase demasiado longa: corta na última palavra antes do limite.
        const cut = plain.slice(0, max);
        best = `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:(\s]+$/, '')}…`;
    }
    return { excerpt: best, truncated: true };
}

/**
 * Ordem das paragens: por dia; dentro do mesmo dia, as partidas para o
 * aeroporto ficam no fim (no último dia vinham antes das visitas).
 */
function orderStops(items: CinemaItineraryItem[], isEn: boolean, excerptMax: number): Stop[] {
    const isDeparture = (title: string) => /^(transfer|regresso|partida para o aeroporto|return|departure)/i.test(title.trim());
    return items
        .map((item, index) => {
            const title = (isEn ? item.title_en || item.title : item.title) || '';
            const description = (isEn ? item.description_en || item.description : item.description) || '';
            const gallery = (Array.isArray(item.images) ? item.images : []).filter(Boolean);
            const hasText = !isRichTextEmpty(description);
            const { excerpt, truncated } = hasText ? excerptOf(description, excerptMax) : { excerpt: '', truncated: false };
            return {
                index,
                stop: { id: item.id, day: item.day_number, title, description: hasText ? description : '', image: gallery[0] || item.image_url || null, excerpt, truncated },
            };
        })
        .sort((a, b) =>
            a.stop.day - b.stop.day
            || Number(isDeparture(a.stop.title)) - Number(isDeparture(b.stop.title))
            || a.index - b.index,
        )
        .map(({ stop }) => stop);
}

function useIsMobile() {
    const [mobile, setMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const sync = () => setMobile(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);
    return mobile;
}

/**
 * Uma imagem do palco, toda ligada ao scroll (suavizado):
 * - a cortina sobe de baixo para cima entre a paragem anterior e esta;
 * - a imagem assenta de um zoom ligeiro enquanto a cortina sobe;
 * - quando a seguinte começa a cobrir, esta recua e escurece.
 */
function Layer({ stop, index, pos, mounted }: { stop: Stop; index: number; pos: MotionValue<number>; mounted: boolean }) {
    const clip = useTransform(pos, [index - 0.92, index - 0.08], index === 0 ? [0, 0] : [100, 0], { clamp: true, ease: easeInOut });
    const clipPath = useTransform(clip, (v) => `inset(${v}% 0% 0% 0%)`);
    const scale = useTransform(pos, [index - 1, index, index + 1], [1.18, 1.03, 0.97], { clamp: true });
    const y = useTransform(pos, [index - 1, index, index + 1], ['5%', '0%', '-3%'], { clamp: true });
    const shade = useTransform(pos, [index, index + 0.92], [0, 0.65], { clamp: true });
    return (
        <motion.div className="pg-film-layer" style={{ zIndex: index + 1, clipPath }} aria-hidden>
            <motion.div className="pg-film-media" style={{ scale, y }}>
                {mounted && stop.image ? (
                    <img src={stop.image} alt="" decoding="async" draggable={false} />
                ) : (
                    <div className="pg-film-empty" />
                )}
            </motion.div>
            <motion.div className="pg-film-shade" style={{ opacity: shade }} />
        </motion.div>
    );
}

/**
 * Legenda da paragem ativa. Não tem animações por tempo: a opacidade e o
 * movimento vêm da posição do scroll (no contentor), por isso a troca de texto
 * acontece sempre com a legenda invisível, a meio da cortina.
 */
function Caption({ stop, index, total, totalDays, isEn, onRead }: { stop: Stop; index: number; total: number; totalDays: number; isEn: boolean; onRead: () => void }) {
    return (
        <div className="pg-film-caption">
            <p className="pg-film-day">
                <span>{isEn ? 'Day' : 'Dia'} {stop.day}</span>
                <span className="pg-film-day-of">{isEn ? `of ${totalDays}` : `de ${totalDays}`}</span>
                <span className="pg-film-day-sep" aria-hidden />
                <span className="pg-film-day-of">{pad(index + 1)} / {pad(total)}</span>
            </p>
            <h3 className="pg-display pg-film-title">{stop.title}</h3>
            {stop.excerpt && <p className="pg-film-excerpt">{stop.excerpt}</p>}
            {stop.description && (
                <button type="button" className="pg-film-read" onClick={onRead}>
                    {stop.truncated ? (isEn ? 'Read the full day' : 'Ler o dia completo') : (isEn ? 'Open this day' : 'Abrir este dia')}
                    <ArrowUpRight size={16} aria-hidden />
                </button>
            )}
        </div>
    );
}

/** Versão sem animação (movimento reduzido): paragens umas a seguir às outras. */
function StaticStops({ stops, totalDays, isEn }: { stops: Stop[]; totalDays: number; isEn: boolean }) {
    return (
        <div className="pg-film-static">
            {stops.map((stop, i) => (
                <article key={stop.id} className="pg-film-static-item">
                    {stop.image && <img src={stop.image} alt="" loading="lazy" decoding="async" />}
                    <div className="pg-wrap">
                        <p className="pg-film-day">
                            <span>{isEn ? 'Day' : 'Dia'} {stop.day}</span>
                            <span className="pg-film-day-of">{isEn ? `of ${totalDays}` : `de ${totalDays}`} · {pad(i + 1)} / {pad(stops.length)}</span>
                        </p>
                        <h3 className="pg-display pg-film-title">{stop.title}</h3>
                        {stop.description && <RichText value={stop.description} className="pg-body mt-4 text-[var(--pg-on-night-muted)]" />}
                    </div>
                </article>
            ))}
        </div>
    );
}

export default function CinemaStops({
    items,
    totalDays,
    isEn,
    skipHref,
    onReaderChange,
}: {
    items: CinemaItineraryItem[];
    totalDays: number;
    isEn: boolean;
    skipHref: string;
    /** Avisa a página quando o leitor abre/fecha (para esconder o botão do chat). */
    onReaderChange?: (open: boolean) => void;
}) {
    const reduce = useReducedMotion();
    const mobile = useIsMobile();
    const stops = useMemo(() => orderStops(items, isEn, mobile ? 170 : 260), [items, isEn, mobile]);
    const n = stops.length;
    const trackRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [reader, setReader] = useState<number | null>(null);

    useEffect(() => {
        onReaderChange?.(reader !== null);
    }, [reader, onReaderChange]);

    const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

    // Posição contínua suavizada (0 → n-1): a cortina, o zoom e o progresso seguem-na.
    const rawPos = useTransform(scrollYProgress, (v) => v * Math.max(n - 1, 1));
    const smoothPos = useSpring(rawPos, SCROLL_SPRING);
    const activeMV = useMotionValue(0);
    useEffect(() => {
        activeMV.set(active);
    }, [active, activeMV]);
    const local = useTransform([smoothPos, activeMV] as MotionValue<number>[], ([p, a]: number[]) => Math.max(-0.62, Math.min(0.62, p - a)));
    // Distância à paragem mais próxima (-0.5 → 0.5): a legenda só se vê perto
    // de uma paragem e troca de texto quando está invisível (a meio da cortina).
    const nearOffset = useTransform(smoothPos, (p) => p - Math.round(p));
    const captionY = useTransform(nearOffset, [-0.5, 0, 0.5], [22, 0, -22]);
    const captionOpacity = useTransform(nearOffset, [-0.34, -0.14, 0.14, 0.34], [0, 1, 1, 0]);
    const captionBlur = useTransform(nearOffset, [-0.34, -0.14, 0.14, 0.34], ['blur(6px)', 'blur(0px)', 'blur(0px)', 'blur(6px)']);
    // Entrada do palco: começa como um cartão com margens e cantos redondos e
    // abre até ao ecrã inteiro enquanto o roteiro sobe; a 1.ª foto sai de um zoom.
    const { scrollYProgress: enterRaw } = useScroll({ target: trackRef, offset: ['start end', 'start start'] });
    const enter = useSpring(enterRaw, { stiffness: 120, damping: 28, mass: 0.5 });
    const stageClip = useTransform(enter, (v) => {
        const k = 1 - v;
        return `inset(${(k * 7).toFixed(2)}% ${(k * 6).toFixed(2)}% 0% ${(k * 6).toFixed(2)}% round ${(k * 34).toFixed(1)}px)`;
    });
    const layersScale = useTransform(enter, [0, 1], [1.18, 1]);
    const entryVisible = useTransform(enter, [0.72, 0.98], [0, 1], { clamp: true });
    const captionVisible = useTransform([captionOpacity, entryVisible] as MotionValue<number>[], ([o, e]: number[]) => o * e);

    // Dica da primeira paragem: some assim que a pessoa começa a descer.
    const hintOpacity = useTransform(smoothPos, [0.02, 0.18], [1, 0], { clamp: true });
    const hintY = useTransform(smoothPos, [0.02, 0.18], [0, -8], { clamp: true });
    const hintVisible = useTransform([hintOpacity, entryVisible] as MotionValue<number>[], ([h, e]: number[]) => h * e);
    // Segmento atual: enche desde o meio da cortina anterior até ao meio da seguinte.
    const segFill = useTransform(local, [-0.5, 0.5], [0.06, 1], { clamp: true });

    // Posição contínua (0 → n-1) só para escolher a paragem, com histerese.
    useMotionValueEvent(smoothPos, 'change', (pos) => {
        if (n <= 1) return;
        setActive((prev) => {
            if (pos > prev + 0.5 + HYSTERESIS) return Math.min(n - 1, Math.round(pos));
            if (pos < prev - 0.5 - HYSTERESIS) return Math.max(0, Math.round(pos));
            return prev;
        });
    });

    const goTo = useCallback((index: number) => {
        const track = trackRef.current;
        if (!track || n <= 1) return;
        const scrollable = track.offsetHeight - window.innerHeight;
        const top = track.getBoundingClientRect().top + window.scrollY + (scrollable * index) / (n - 1);
        window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    }, [n, reduce]);

    if (n === 0) {
        return (
            <section id="itinerary" className="pg-night pg-wrap py-[var(--pg-section)]">
                <p className="pg-body text-[var(--pg-on-night-muted)]">{isEn ? 'Detailed itinerary coming soon.' : 'Roteiro detalhado em breve.'}</p>
            </section>
        );
    }

    return (
        <section id="itinerary" className="pg-film pg-night" aria-labelledby="pg-film-heading">
            <div className="pg-wrap pg-film-intro">
                <Reveal>
                    <p className="pg-meta pg-eyebrow text-[var(--pg-on-night-muted)]">{isEn ? 'Day by day' : 'Dia a dia'}</p>
                </Reveal>
                <h2 id="pg-film-heading" className="pg-display pg-film-heading">
                    <MaskText text={isEn ? `${totalDays} days, ${n} stops.` : `${totalDays} dias, ${n} paragens.`} />
                </h2>
                <Reveal delay={0.2} className="pg-film-intro-foot">
                    <p className="pg-body text-[var(--pg-on-night-muted)]">
                        {isEn ? 'The itinerary as you will live it. Scroll slowly.' : 'O roteiro, tal como o vai viver. Desça devagar.'}
                    </p>
                    <a href={skipHref} className="pg-route-link" data-track="pilgrimage_nav_clicked" data-track-target="pricing">
                        {isEn ? 'Skip to price and details' : 'Saltar para preço e detalhes'} <ArrowDown size={15} aria-hidden />
                    </a>
                </Reveal>
            </div>

            {reduce ? (
                <StaticStops stops={stops} totalDays={totalDays} isEn={isEn} />
            ) : (
                <div ref={trackRef} className="pg-film-track" style={{ ['--n' as string]: n }}>
                    <motion.div className="pg-film-stage pg-grain" style={{ clipPath: stageClip }}>
                        <motion.div className="pg-film-layers" style={{ scale: layersScale }}>
                            {stops.map((stop, i) => (
                                <Layer
                                    key={stop.id}
                                    stop={stop}
                                    index={i}
                                    pos={smoothPos}
                                    mounted={Math.abs(i - active) <= MOUNT_WINDOW}
                                />
                            ))}
                        </motion.div>
                        <div className="pg-film-grad" aria-hidden />

                        {/* Dica só na primeira paragem */}
                        {active === 0 && n > 1 && (
                            <motion.div className="pg-film-hint" style={{ opacity: hintVisible, y: hintY }} aria-hidden>
                                <span className="pg-film-hint-icon"><span /></span>
                                <span>{isEn ? 'Scroll to see more' : 'Deslize para ver mais'}</span>
                            </motion.div>
                        )}

                        {/* Progresso: um segmento por paragem, cada um salta para ela */}
                        <motion.div className="pg-film-progress" style={{ opacity: entryVisible }}>
                            <ol className="pg-film-segments" aria-label={isEn ? 'Itinerary stops' : 'Paragens do roteiro'}>
                                {stops.map((stop, i) => (
                                    <li key={stop.id}>
                                        <button
                                            type="button"
                                            onClick={() => goTo(i)}
                                            className={`pg-film-seg ${i < active ? 'is-past' : ''} ${i === active ? 'is-current' : ''}`}
                                            aria-label={`${isEn ? 'Day' : 'Dia'} ${stop.day} · ${stop.title}`}
                                            aria-current={i === active ? 'step' : undefined}
                                        >
                                            {i === active && <motion.span className="pg-film-seg-fill" style={{ scaleX: segFill }} aria-hidden />}
                                        </button>
                                    </li>
                                ))}
                            </ol>
                            <a href={skipHref} className="pg-film-skip" data-track="pilgrimage_nav_clicked" data-track-target="pricing">
                                {isEn ? 'Skip' : 'Saltar roteiro'} <ArrowDown size={13} aria-hidden />
                            </a>
                        </motion.div>

                        <motion.div className="pg-film-caption-wrap" aria-live="polite" style={{ y: captionY, opacity: captionVisible, filter: captionBlur }}>
                                <Caption
                                    key={stops[active].id}
                                    stop={stops[active]}
                                    index={active}
                                    total={n}
                                    totalDays={totalDays}
                                    isEn={isEn}
                                    onRead={() => setReader(active)}
                                />
                        </motion.div>
                    </motion.div>
                </div>
            )}

            <StopReader
                stops={stops}
                index={reader}
                totalDays={totalDays}
                isEn={isEn}
                onClose={() => setReader(null)}
                onChange={(i) => setReader(i)}
            />
        </section>
    );
}
