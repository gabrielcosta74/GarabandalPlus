"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { InkReveal, MaskText, ParallaxMedia, Reveal } from './primitives';
import { EASE_CINE, EASE_OUT } from './motion';
import type { CinemaStage } from './types';

type Place = { title: string; x: number; y: number; at: number };

const VIEW_W = 1000;
const VIEW_H = 560;
const PAD = 48;
/** Duração do desenho do percurso (segundos). */
const DRAW = 2.8;

/** Lugares únicos pela ordem do percurso (paragens seguidas com o mesmo nome contam uma vez). */
function uniquePlaces(stages: CinemaStage[]) {
    const sorted = [...stages]
        .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
        .sort((a, b) => a.display_order - b.display_order);
    const out: { title: string; lat: number; lng: number }[] = [];
    for (const s of sorted) {
        const title = s.title.trim();
        const prev = out[out.length - 1];
        if (prev && prev.title.toLowerCase() === title.toLowerCase()) continue;
        out.push({ title, lat: Number(s.lat), lng: Number(s.lng) });
    }
    return out;
}

/** Projeção simples (equiretangular corrigida pela latitude) para caber no SVG. */
function project(places: { title: string; lat: number; lng: number }[]): Place[] {
    if (places.length === 0) return [];
    const midLat = places.reduce((sum, p) => sum + p.lat, 0) / places.length;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xs = places.map((p) => p.lng * k);
    const ys = places.map((p) => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 0.01);
    const spanY = Math.max(maxY - minY, 0.01);
    const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanY);
    const offX = (VIEW_W - spanX * scale) / 2;
    const offY = (VIEW_H - spanY * scale) / 2;
    const pts = places.map((p, i) => ({ title: p.title, x: offX + (xs[i] - minX) * scale, y: offY + (ys[i] - minY) * scale, at: 0 }));
    const seg = pts.map((p, i) => (i === 0 ? 0 : Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)));
    const total = seg.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return pts.map((p, i) => {
        acc += seg[i];
        return { ...p, at: acc / total };
    });
}

/** Curva suave (Catmull-Rom → Bézier) a passar por todos os pontos. */
function smoothPath(pts: Place[]) {
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const t = 0.18;
        d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
    }
    return d;
}

/** Fundo da secção: aldeia de Garabandal (WebP otimizado, 900px e 1672px). */
const ROUTE_BG = {
    src: '/images/pilgrimages/garabandal-aldeia-1672.webp',
    srcSet: '/images/pilgrimages/garabandal-aldeia-900.webp 900w, /images/pilgrimages/garabandal-aldeia-1672.webp 1672w',
};

/** Nomes curtos para a linha de lugares ("Aeroporto de Lisboa" → "Lisboa"). */
const shortName = (title: string) => title.replace(/^aeroporto de\s+/i, '').replace(/^le\s+/i, '').replace(/-fallavaux$/i, '');

export default function RouteSection({
    statement,
    mission,
    supportLink,
    stages,
    isEn,
}: {
    statement: string;
    mission: string;
    supportLink?: { href: string; label: string };
    stages: CinemaStage[];
    isEn: boolean;
}) {
    const reduce = useReducedMotion();
    const places = useMemo(() => project(uniquePlaces(stages)), [stages]);
    const d = useMemo(() => smoothPath(places), [places]);
    const first = places[0];
    const last = places[places.length - 1];

    return (
        <section id="overview" className="pg-route pg-night relative isolate" aria-labelledby="pg-route-heading">
            <div className="pg-route-bg" aria-hidden>
                <ParallaxMedia className="h-full" distance={8} zoom={0.1}>
                    <img src={ROUTE_BG.src} srcSet={ROUTE_BG.srcSet} sizes="100vw" alt="" loading="lazy" decoding="async" />
                </ParallaxMedia>
                <div className="pg-route-bg-shade" />
            </div>
            <div className="pg-wrap pg-route-grid">
                <div className="pg-route-head">
                    <Reveal>
                        <p className="pg-meta pg-eyebrow text-[var(--pg-on-night-muted)]">{isEn ? 'The journey' : 'O caminho'}</p>
                    </Reveal>
                    <h2 id="pg-route-heading" className="pg-route-title">
                        <span className="pg-display block">
                            <MaskText text={isEn ? 'More than a journey,' : 'Mais do que uma viagem,'} />
                        </span>
                        <motion.span
                            className="pg-script pg-route-script"
                            initial={reduce ? false : { clipPath: 'inset(-20% 100% -20% 0%)', opacity: 0 }}
                            whileInView={{ clipPath: 'inset(-20% -5% -20% 0%)', opacity: 1 }}
                            viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                            transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.5 }}
                        >
                            {isEn ? 'a mission.' : 'uma missão.'}
                        </motion.span>
                    </h2>
                </div>

                <div className="pg-route-copy">
                    {statement && (
                        <InkReveal className="pg-route-lead">
                            <p>{statement}</p>
                        </InkReveal>
                    )}
                    <InkReveal className="pg-route-mission" delay={0.25}>
                        <p>{mission}</p>
                    </InkReveal>
                    {supportLink && (
                        <Reveal delay={0.4}>
                            <Link href={supportLink.href} className="pg-route-link">
                                {supportLink.label} <ArrowUpRight size={16} aria-hidden />
                            </Link>
                        </Reveal>
                    )}
                </div>
            </div>

            {places.length > 1 && (
                <div className="pg-wrap pg-route-strip">
                    <motion.svg
                        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                        className="pg-route-svg"
                        role="img"
                        aria-label={places.map((p) => p.title).join(' → ')}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '0px 0px -20% 0px' }}
                    >
                        <path d={d} fill="none" stroke="var(--pg-night-line)" strokeWidth={1.25} strokeDasharray="1.5 7" strokeLinecap="round" />
                        <motion.path
                            d={d}
                            fill="none"
                            stroke="var(--pg-highlight)"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            variants={{
                                hidden: { pathLength: reduce ? 1 : 0 },
                                show: { pathLength: 1, transition: { duration: reduce ? 0 : DRAW, ease: EASE_CINE } },
                            }}
                        />
                        {places.map((place, i) => (
                            <motion.circle
                                key={place.title + i}
                                cx={place.x}
                                cy={place.y}
                                r={i === 0 || i === places.length - 1 ? 6 : 4}
                                fill="var(--pg-night)"
                                stroke="var(--pg-highlight)"
                                strokeWidth={1.75}
                                variants={{
                                    hidden: { scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 },
                                    show: {
                                        scale: 1,
                                        opacity: 1,
                                        transition: { duration: 0.5, ease: EASE_OUT, delay: reduce ? 0 : place.at * DRAW * 0.92 },
                                    },
                                }}
                                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            />
                        ))}
                        {first && (
                            <motion.text
                                x={first.x}
                                y={first.y + 34}
                                textAnchor="middle"
                                className="pg-route-svg-label"
                                variants={{ hidden: { opacity: reduce ? 1 : 0 }, show: { opacity: 1, transition: { delay: reduce ? 0 : 0.3, duration: 0.6 } } }}
                            >
                                {shortName(first.title)}
                            </motion.text>
                        )}
                        {last && last !== first && (
                            <motion.text
                                x={last.x}
                                y={last.y - 22}
                                textAnchor="middle"
                                className="pg-route-svg-label"
                                variants={{ hidden: { opacity: reduce ? 1 : 0 }, show: { opacity: 1, transition: { delay: reduce ? 0 : DRAW, duration: 0.6 } } }}
                            >
                                {shortName(last.title)}
                            </motion.text>
                        )}
                    </motion.svg>

                    <div className="pg-route-side">
                        <motion.ol
                            className="pg-route-places"
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                            variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : DRAW / places.length } } }}
                        >
                            {places.map((place, i) => (
                                <motion.li
                                    key={place.title + i}
                                    variants={{
                                        hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 },
                                        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
                                    }}
                                >
                                    {shortName(place.title)}
                                </motion.li>
                            ))}
                        </motion.ol>
                    </div>
                </div>
            )}

        </section>
    );
}
