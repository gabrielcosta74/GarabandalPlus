"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowDown } from 'lucide-react';
import {
    motion,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from 'framer-motion';
import { MaskText } from './primitives';
import { DUR, EASE_CINE, EASE_OUT, SPRING } from './motion';
import CtaButton from './CtaButton';
import type { BookingCta } from './types';

type Props = {
    title: string;
    coverImage?: string | null;
    /** Uma linha curta, por exemplo "11–24 de outubro de 2027 · 14 dias". */
    meta: string;
    scarcityLabel?: string | null;
    back: { href: string; label: string };
    cta: BookingCta;
    itineraryLabel: string;
};

/**
 * Hero da peregrinação.
 * - Capa em cartaz (quase quadrada ou vertical, com texto desenhado): o cartaz
 *   aparece inteiro, emoldurado, sobre uma versão desfocada dele próprio.
 *   Nenhum texto HTML fica por cima do cartaz.
 * - Capa em paisagem (foto larga): passa a ecrã inteiro, com o título por cima.
 * O título "A - B - C" divide-se: a primeira parte em grande, o resto manuscrito.
 */
export default function CinemaHero({ title, coverImage, meta, scarcityLabel, back, cta, itineraryLabel }: Props) {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLElement>(null);
    const [mode, setMode] = useState<'poster' | 'landscape'>('poster');

    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const progress = useSpring(scrollYProgress, SPRING.media);
    const posterY = useTransform(progress, [0, 1], ['0%', '16%']);
    const posterScale = useTransform(progress, [0, 1], [1, 0.92]);
    const copyY = useTransform(progress, [0.3, 1], ['0%', '-14%']);
    const fade = useTransform(progress, [0.45, 0.92], [1, 0]);
    const ambientY = useTransform(progress, [0, 1], ['0%', '12%']);

    // Inclinação 3D muito ligeira do cartaz a seguir o rato (só com rato).
    const rx = useMotionValue(0);
    const ry = useMotionValue(0);
    const srx = useSpring(rx, SPRING.ui);
    const sry = useSpring(ry, SPRING.ui);
    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (reduce || event.pointerType !== 'mouse') return;
        const rect = event.currentTarget.getBoundingClientRect();
        ry.set(((event.clientX - rect.left) / rect.width - 0.5) * 6);
        rx.set(((event.clientY - rect.top) / rect.height - 0.5) * -6);
    };
    const onPointerLeave = () => {
        rx.set(0);
        ry.set(0);
    };

    const onCoverLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const img = event.currentTarget;
        if (img.naturalWidth && img.naturalHeight && img.naturalWidth / img.naturalHeight >= 1.3) setMode('landscape');
    };

    const enter = (delay: number) =>
        reduce
            ? {}
            : {
                  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
                  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
                  transition: { duration: DUR.slow, ease: EASE_OUT, delay },
              };

    const titleParts = title.split(/\s+[-–—]\s+/).filter(Boolean);
    const mainTitle = titleParts[0] || title;
    const subTitle = titleParts.slice(1).join(' · ');

    return (
        <section
            ref={ref}
            className={`pg-hero pg-night pg-grain relative isolate overflow-hidden ${mode === 'landscape' ? 'is-landscape' : 'is-poster'}`}
            aria-label={title}
        >
            {/* Fundo: o próprio cartaz, ampliado, desfocado e a respirar devagar */}
            {coverImage && (
                <motion.div
                    className="pg-hero-ambient"
                    aria-hidden
                    style={reduce ? undefined : { y: ambientY }}
                    initial={reduce ? false : { opacity: 0, scale: 1.25 }}
                    animate={{ opacity: 1, scale: 1.1 }}
                    transition={{ duration: 3.2, ease: EASE_OUT }}
                >
                    <img src={coverImage} alt="" decoding="async" />
                </motion.div>
            )}
            <div className="pg-hero-vignette" aria-hidden />

            <div className="pg-hero-inner">
                {coverImage && (
                    <motion.div
                        className="pg-hero-poster-wrap"
                        style={reduce ? undefined : { y: posterY, scale: posterScale }}
                        onPointerMove={onPointerMove}
                        onPointerLeave={onPointerLeave}
                    >
                        <motion.div
                            className="pg-hero-poster"
                            style={reduce ? undefined : { rotateX: srx, rotateY: sry }}
                            initial={reduce ? false : { clipPath: 'inset(100% 0% 0% 0% round 18px)', y: 70 }}
                            animate={{ clipPath: 'inset(0% 0% 0% 0% round 18px)', y: 0 }}
                            transition={{ duration: DUR.cine, ease: EASE_CINE, delay: 0.2 }}
                        >
                            <motion.img
                                src={coverImage}
                                alt={title}
                                fetchPriority="high"
                                decoding="async"
                                onLoad={onCoverLoad}
                                initial={reduce ? false : { scale: 1.18 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: DUR.cine + 0.8, ease: EASE_OUT, delay: 0.2 }}
                            />
                        </motion.div>
                    </motion.div>
                )}

                <motion.div className="pg-hero-copy" style={reduce ? undefined : { y: copyY, opacity: fade }}>
                    <motion.div {...enter(0.25)}>
                        <Link href={back.href} className="pg-back">
                            <span className="pg-back-icon" aria-hidden><ArrowLeft size={16} /></span>
                            <span>{back.label}</span>
                        </Link>
                    </motion.div>

                    <h1 className="pg-hero-title">
                        <span className="pg-display pg-hero-main">
                            <MaskText text={mainTitle} inView={false} delay={0.45} stagger={0.06} />
                        </span>
                        {subTitle && (
                            <motion.span
                                className="pg-script pg-hero-script"
                                initial={reduce ? false : { clipPath: 'inset(-20% 100% -20% 0%)', opacity: 0 }}
                                animate={{ clipPath: 'inset(-20% -5% -20% 0%)', opacity: 1 }}
                                transition={{ duration: 1.8, ease: EASE_OUT, delay: 1.05 }}
                            >
                                {subTitle}
                            </motion.span>
                        )}
                    </h1>

                    <motion.p className="pg-hero-meta" {...enter(1.25)}>
                        {meta}
                        {scarcityLabel && <span className="pg-hero-scarcity">{scarcityLabel}</span>}
                    </motion.p>

                    <motion.div className="pg-hero-actions" {...enter(1.4)}>
                        <CtaButton cta={cta} placement="hero" />
                        <a
                            href="#itinerary"
                            className="pg-btn pg-btn-ghost pg-hero-secondary"
                            data-track="pilgrimage_nav_clicked"
                            data-track-target="itinerary"
                        >
                            <span>{itineraryLabel}</span>
                            <ArrowDown size={16} aria-hidden />
                        </a>
                    </motion.div>
                </motion.div>
            </div>

            <motion.div className="pg-hero-cue" aria-hidden style={reduce ? undefined : { opacity: fade }}>
                <motion.span
                    className="pg-hero-cue-line"
                    initial={reduce ? false : { opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ delay: 2, duration: 1.2, ease: EASE_OUT }}
                />
            </motion.div>
        </section>
    );
}
