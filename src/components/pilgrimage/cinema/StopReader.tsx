"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import RichText from '../RichText';
import { pgFontVariables } from './fonts';
import { EASE_CINE, EASE_OUT } from './motion';

export type ReaderStop = {
    id: string;
    day: number;
    title: string;
    description: string;
    image: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Leitor do dia completo. Desktop: painel à direita por cima do palco.
 * Mobile: sheet que sobe e se fecha a arrastar para baixo.
 */
export default function StopReader({
    stops,
    index,
    totalDays,
    isEn,
    onClose,
    onChange,
}: {
    stops: ReaderStop[];
    index: number | null;
    totalDays: number;
    isEn: boolean;
    onClose: () => void;
    onChange: (index: number) => void;
}) {
    const reduce = useReducedMotion();
    const [mounted, setMounted] = useState(false);
    const [direction, setDirection] = useState(1);
    const [mobile, setMobile] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();
    const open = index !== null;

    useEffect(() => {
        setMounted(true);
        const mq = window.matchMedia('(max-width: 767px)');
        const sync = () => setMobile(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && index !== null && index < stops.length - 1) {
                setDirection(1);
                onChange(index + 1);
            }
            if (e.key === 'ArrowLeft' && index !== null && index > 0) {
                setDirection(-1);
                onChange(index - 1);
            }
        };
        window.addEventListener('keydown', onKey);
        panelRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [open, index, stops.length, onClose, onChange]);

    useEffect(() => {
        panelRef.current?.querySelector('.pg-reader-scroll')?.scrollTo({ top: 0 });
    }, [index]);

    if (!mounted) return null;

    const stop = index !== null ? stops[index] : null;
    const go = (delta: number) => {
        if (index === null) return;
        const next = index + delta;
        if (next < 0 || next >= stops.length) return;
        setDirection(delta);
        onChange(next);
    };
    const onDragEnd = (_: unknown, info: PanInfo) => {
        if (info.offset.y > 140 || info.velocity.y > 700) onClose();
    };

    return createPortal(
        <div className={`pg-scope ${pgFontVariables}`}>
            <AnimatePresence>
                {open && stop && (
                    <>
                        <motion.div
                            key="reader-backdrop"
                            className="pg-reader-backdrop"
                            onClick={onClose}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                        />
                        <motion.div
                            key="reader"
                            ref={panelRef}
                            tabIndex={-1}
                            role="dialog"
                            aria-modal="true"
                            aria-label={stop.title}
                            className="pg-reader"
                            drag={mobile && !reduce ? 'y' : false}
                            dragControls={dragControls}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0, bottom: 0.5 }}
                            dragListener={false}
                            onDragEnd={onDragEnd}
                            initial={reduce ? false : mobile ? { y: '100%' } : { x: '100%' }}
                            animate={mobile ? { y: 0 } : { x: 0 }}
                            exit={mobile ? { y: '100%' } : { x: '100%' }}
                            transition={{ duration: 0.65, ease: EASE_CINE }}
                        >
                            <div className="pg-reader-bar" onPointerDown={(e) => mobile && dragControls.start(e)}>
                                <span className="pg-reader-handle" aria-hidden />
                                <span className="pg-reader-count">{pad(index! + 1)} / {pad(stops.length)}</span>
                                <div className="pg-reader-nav">
                                    <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label={isEn ? 'Previous stop' : 'Paragem anterior'}>
                                        <ArrowLeft size={17} aria-hidden />
                                    </button>
                                    <button type="button" onClick={() => go(1)} disabled={index === stops.length - 1} aria-label={isEn ? 'Next stop' : 'Próxima paragem'}>
                                        <ArrowRight size={17} aria-hidden />
                                    </button>
                                    <button type="button" onClick={onClose} aria-label={isEn ? 'Close' : 'Fechar'}>
                                        <X size={17} aria-hidden />
                                    </button>
                                </div>
                            </div>

                            <div className="pg-reader-scroll">
                                <AnimatePresence mode="wait" initial={false} custom={direction}>
                                    <motion.article
                                        key={stop.id}
                                        custom={direction}
                                        initial={reduce ? false : { opacity: 0, x: direction * 28 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: direction * -28 }}
                                        transition={{ duration: 0.4, ease: EASE_OUT }}
                                    >
                                        {stop.image && (
                                            <div className="pg-reader-media">
                                                <img src={stop.image} alt={stop.title} decoding="async" />
                                            </div>
                                        )}
                                        <div className="pg-reader-body">
                                            <p className="pg-film-day">
                                                <span>{isEn ? 'Day' : 'Dia'} {stop.day}</span>
                                                <span className="pg-film-day-of">{isEn ? `of ${totalDays}` : `de ${totalDays}`}</span>
                                            </p>
                                            <h3 className="pg-display pg-reader-title">{stop.title}</h3>
                                            <RichText value={stop.description} className="pg-reader-text" />
                                        </div>
                                    </motion.article>
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>,
        document.body,
    );
}
