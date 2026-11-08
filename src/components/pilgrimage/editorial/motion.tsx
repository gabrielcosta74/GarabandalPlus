"use client";

import { useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, type MotionStyle } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Entrada ao entrar no ecrã: sobe e desfoca → nítido. */
export function Reveal({
    children,
    delay = 0,
    y = 32,
    className,
    as = 'div',
}: {
    children: ReactNode;
    delay?: number;
    y?: number;
    className?: string;
    as?: 'div' | 'li' | 'section';
}) {
    const reduce = useReducedMotion();
    const Comp = motion[as];
    return (
        <Comp
            className={className}
            initial={reduce ? false : { opacity: 0, y, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '0px 0px -12% 0px' }}
            transition={{ duration: 1.1, ease: EASE, delay }}
        >
            {children}
        </Comp>
    );
}

/**
 * Texto que sobe de dentro de uma máscara, palavra a palavra.
 * O "em vista" é medido no contentor (as palavras escondidas estão recortadas
 * pela máscara e nunca contariam como visíveis).
 */
export function MaskText({
    text,
    className,
    delay = 0,
    stagger = 0.06,
    inView = true,
}: {
    text: string;
    className?: string;
    delay?: number;
    stagger?: number;
    inView?: boolean;
}) {
    const reduce = useReducedMotion();
    const words = text.split(' ');
    const trigger = inView
        ? { whileInView: 'show' as const, viewport: { once: true, margin: '0px 0px -8% 0px' } }
        : { animate: 'show' as const };
    return (
        <motion.span
            className={className}
            initial={reduce ? false : 'hidden'}
            {...trigger}
            variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
        >
            {words.map((word, i) => (
                <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                    <motion.span
                        className="inline-block origin-bottom-left"
                        variants={{
                            hidden: { y: '110%', rotate: 4 },
                            show: { y: '0%', rotate: 0, transition: { duration: 1.05, ease: EASE } },
                        }}
                    >
                        {word}
                        {i < words.length - 1 ? '\u00a0' : ''}
                    </motion.span>
                </span>
            ))}
        </motion.span>
    );
}

/** Botão/elemento "magnético": segue ligeiramente o cursor (só com rato). */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
    const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

    const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (reduce || event.pointerType !== 'mouse' || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const reset = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            style={{ x: sx, y: sy } as MotionStyle}
            onPointerMove={onMove}
            onPointerLeave={reset}
        >
            {children}
        </motion.div>
    );
}
