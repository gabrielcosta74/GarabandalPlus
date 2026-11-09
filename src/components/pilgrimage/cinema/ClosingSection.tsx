"use client";

import Link from 'next/link';
import { motion, useReducedMotion, useTransform } from 'framer-motion';
import { MaskText, Reveal, useSectionProgress } from './primitives';
import CtaButton from './CtaButton';
import type { BookingCta } from './types';

export default function ClosingSection({
    image,
    dateRange,
    cta,
    back,
    isEn,
}: {
    image?: string | null;
    dateRange: string;
    cta: BookingCta;
    back: { href: string; label: string };
    isEn: boolean;
}) {
    const reduce = useReducedMotion();
    const { ref, progress } = useSectionProgress<HTMLElement>();
    const scale = useTransform(progress, [0, 1], [1.25, 1.05]);

    return (
        <section ref={ref} className="pg-closing pg-night pg-grain relative isolate overflow-hidden">
            {image && (
                <motion.div className="pg-closing-bg" aria-hidden style={reduce ? undefined : { scale }}>
                    <img src={image} alt="" loading="lazy" decoding="async" />
                </motion.div>
            )}
            <div className="pg-closing-shade" aria-hidden />
            <div className="pg-wrap pg-closing-inner">
                <Reveal>
                    <p className="pg-meta pg-eyebrow text-[var(--pg-on-night-muted)]">{dateRange}</p>
                </Reveal>
                <h2 className="pg-display pg-closing-title">
                    <MaskText text={isEn ? 'Come and walk this path with us.' : 'Venha fazer este caminho connosco.'} />
                </h2>
                <Reveal delay={0.2} className="pg-closing-actions">
                    <CtaButton cta={cta} placement="closing" />
                    <Link href={back.href} className="pg-btn pg-btn-ghost">{back.label}</Link>
                </Reveal>
            </div>
        </section>
    );
}
