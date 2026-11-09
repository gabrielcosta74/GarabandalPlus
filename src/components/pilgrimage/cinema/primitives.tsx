"use client";

import { useRef, type ReactNode } from 'react';
import {
    motion,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from 'framer-motion';
import { DUR, EASE_CINE, EASE_OUT, IN_VIEW_MARGIN, SPRING } from './motion';

// Primitivas partilhadas com a página da lista (/peregrinacoes).
export { Reveal, MaskText, Magnetic } from '../editorial/motion';

/**
 * Imagem que se revela com uma cortina (clip-path) e assenta de um ligeiro zoom.
 * Só anima transform, opacity e clip-path, por isso não provoca reflow.
 */
export function ClipReveal({
    children,
    className,
    from = 'bottom',
    delay = 0,
}: {
    children: ReactNode;
    className?: string;
    from?: 'bottom' | 'left' | 'right';
    delay?: number;
}) {
    const reduce = useReducedMotion();
    const hidden = {
        bottom: 'inset(100% 0% 0% 0%)',
        left: 'inset(0% 100% 0% 0%)',
        right: 'inset(0% 0% 0% 100%)',
    }[from];
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { clipPath: hidden }}
            whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }}
            viewport={{ once: true, margin: IN_VIEW_MARGIN }}
            transition={{ duration: DUR.cine, ease: EASE_CINE, delay }}
        >
            <motion.div
                className="h-full w-full"
                initial={reduce ? false : { scale: 1.18 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true, margin: IN_VIEW_MARGIN }}
                transition={{ duration: DUR.cine + 0.4, ease: EASE_OUT, delay }}
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

/**
 * Progresso (0 → 1) de um elemento a atravessar o ecrã, com mola.
 * 0 = topo do elemento entra por baixo; 1 = fundo do elemento sai por cima.
 */
export function useSectionProgress<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const progress = useSpring(scrollYProgress, SPRING.media);
    return { ref, progress, raw: scrollYProgress };
}

/**
 * Media com parallax suave: desloca-se mais devagar que o scroll e sai de um
 * ligeiro zoom. O contentor tem de ter overflow: hidden e altura definida.
 */
export function ParallaxMedia({
    children,
    className,
    distance = 12,
    zoom = 0.08,
}: {
    children: ReactNode;
    className?: string;
    /** Deslocamento máximo, em % da altura. */
    distance?: number;
    /** Zoom extra no início (0.08 = 108%). */
    zoom?: number;
}) {
    const reduce = useReducedMotion();
    const { ref, progress } = useSectionProgress<HTMLDivElement>();
    const y = useTransform(progress, [0, 1], [`-${distance}%`, `${distance}%`]);
    const scale = useTransform(progress, [0, 0.5, 1], [1 + zoom, 1 + zoom / 2, 1 + zoom]);
    return (
        <div ref={ref} className={`relative overflow-hidden ${className ?? ''}`}>
            <motion.div
                className="absolute inset-[-14%_0] will-change-transform"
                style={reduce ? undefined : { y, scale }}
            >
                {children}
            </motion.div>
        </div>
    );
}

/**
 * Texto que aparece como tinta a espalhar-se: uma máscara em diagonal varre o
 * bloco da esquerda para a direita (todas as linhas ao mesmo tempo).
 * Anima só a variável --ink (ver .pg-ink em cinema.css).
 */
export function InkReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className={`pg-ink ${className ?? ''}`}
            initial={reduce ? false : ({ '--ink': '-40%', y: 14 } as never)}
            whileInView={{ '--ink': '150%', y: 0 } as never}
            viewport={{ once: true, margin: IN_VIEW_MARGIN }}
            transition={{ duration: 2, ease: EASE_OUT, delay }}
        >
            {children}
        </motion.div>
    );
}

/** Mapeia um MotionValue de progresso para opacidade numa janela [start, end]. */
export function useFadeWindow(progress: MotionValue<number>, start: number, end: number) {
    const fadeIn = start + (end - start) * 0.2;
    const fadeOut = end - (end - start) * 0.2;
    return useTransform(progress, [start, fadeIn, fadeOut, end], [0, 1, 1, 0]);
}
