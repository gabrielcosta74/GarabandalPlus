"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { ArrowUpRight, ChevronUp, X } from 'lucide-react';
import CtaButton from './CtaButton';
import { PriceBlock } from './PracticalSection';
import { pgFontVariables } from './fonts';
import { EASE_CINE, EASE_OUT } from './motion';
import type { BookingCta, BookingSummary } from './types';

type Zone = 'hero' | 'closing' | 'night' | 'light';

/** Em que tipo de secção está o centro do ecrã (o painel adapta-se). */
function useZone(): Zone {
    const [zone, setZone] = useState<Zone>('hero');
    useEffect(() => {
        let frame = 0;
        const read = () => {
            frame = 0;
            const el = document.elementFromPoint(window.innerWidth * 0.3, window.innerHeight * 0.55);
            let next: Zone = 'light';
            if (!el || el.closest('.pg-hero')) next = 'hero';
            else if (el.closest('.pg-closing')) next = 'closing';
            else if (el.closest('.pg-night')) next = 'night';
            setZone((prev) => (prev === next ? prev : next));
        };
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(read);
        };
        read();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);
    return zone;
}

function useIsDesktop() {
    const [desktop, setDesktop] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const sync = () => setDesktop(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);
    return desktop;
}

function Details({ summary, isEn, onAction }: { summary: BookingSummary; isEn: boolean; onAction?: () => void }) {
    const open = (fn: () => void) => () => {
        onAction?.();
        fn();
    };
    return (
        <>
            {(summary.hasIncludedInfo || summary.hasFlightInfo) && (
                <div className="pg-dock-links">
                    {summary.hasIncludedInfo && (
                        <button type="button" className="pg-dock-link" onClick={open(summary.onOpenIncluded)}>
                            <span>
                                <span className="pg-dock-link-title">{isEn ? "See what's included in the land package" : 'Ver o que está incluído no terrestre'}</span>
                                <span className="pg-dock-link-hint">{isEn ? 'What is and is not included in the price above.' : 'Incluído e não incluído no valor acima.'}</span>
                            </span>
                            <span className="pg-dock-link-icon" aria-hidden><ArrowUpRight size={15} /></span>
                        </button>
                    )}
                    {summary.hasFlightInfo && (
                        <button type="button" className="pg-dock-link" onClick={open(summary.onOpenFlights)}>
                            <span>
                                <span className="pg-dock-link-title">{summary.flightsLabel}</span>
                                <span className="pg-dock-link-hint">{summary.flightsHint}</span>
                            </span>
                            <span className="pg-dock-link-icon" aria-hidden><ArrowUpRight size={15} /></span>
                        </button>
                    )}
                </div>
            )}
            <dl className="pg-dock-dates">
                <div>
                    <dt className="pg-meta">{isEn ? 'Departure' : 'Partida'}</dt>
                    <dd>{summary.departureLabel}</dd>
                </div>
                {summary.deadlineLabel && (
                    <div>
                        <dt className="pg-meta">{isEn ? 'Registrations until' : 'Inscrições até'}</dt>
                        <dd>{summary.deadlineLabel}</dd>
                    </div>
                )}
            </dl>
            {summary.lastSpots && (
                <p className="pg-meta pg-last-spots"><span className="pg-dot bg-red-500" aria-hidden /> {isEn ? 'Last spots — almost fully booked' : 'Últimos lugares — quase esgotado'}</p>
            )}
        </>
    );
}

/**
 * Painel de inscrição sempre à mão.
 * Desktop: cartão completo à direita nas secções claras; nas secções escuras
 * (caminho e paragens) recolhe-se numa cápsula em baixo, que reabre com "Detalhes".
 * Mobile: barra em baixo (preço + botão) e uma sheet com tudo, que se arrasta.
 * No desktop fica escondido no hero e no fecho, que têm o seu próprio botão.
 */
export default function BookingDock({
    cta,
    summary,
    isEn,
    hideOnMobile,
    onSheetChange,
}: {
    cta: BookingCta;
    summary: BookingSummary;
    isEn: boolean;
    /** Encerrada sem lista de espera: no mobile a barra não aparece (como antes). */
    hideOnMobile: boolean;
    /** Avisa a página quando a sheet abre/fecha (para esconder o botão do chat). */
    onSheetChange?: (open: boolean) => void;
}) {
    const reduce = useReducedMotion();
    const [mounted, setMounted] = useState(false);
    const zone = useZone();
    const desktop = useIsDesktop();
    const [peek, setPeek] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => setMounted(true), []);
    useEffect(() => setPeek(false), [zone]);

    // Mobile: a barra está sempre à mão (como antes), menos no fecho, que tem o seu botão.
    const barVisible = mounted && !desktop && !hideOnMobile && zone !== 'closing';

    // A altura da barra do mobile sobe o botão do chat (--sticky-bar-h).
    useEffect(() => {
        const root = document.documentElement;
        const el = barRef.current;
        if (!barVisible || !el) {
            root.style.setProperty('--sticky-bar-h', '0px');
            return;
        }
        const sync = () => root.style.setProperty('--sticky-bar-h', `${el.offsetHeight}px`);
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => {
            ro.disconnect();
            root.style.setProperty('--sticky-bar-h', '0px');
        };
    }, [barVisible]);

    useEffect(() => {
        onSheetChange?.(sheetOpen);
    }, [sheetOpen, onSheetChange]);

    useEffect(() => {
        if (!sheetOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [sheetOpen]);

    if (!mounted) return null;

    const showCard = desktop && (zone === 'light' || (zone === 'night' && peek));
    const showPill = desktop && zone === 'night' && !peek;
    const cardMotion = reduce
        ? {}
        : {
              initial: { opacity: 0, x: 40, filter: 'blur(10px)' },
              animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
              exit: { opacity: 0, x: 40, filter: 'blur(10px)' },
              transition: { duration: 0.6, ease: EASE_CINE },
          };
    const pillMotion = reduce
        ? {}
        : {
              initial: { opacity: 0, y: 40, scale: 0.94 },
              animate: { opacity: 1, y: 0, scale: 1 },
              exit: { opacity: 0, y: 40, scale: 0.94 },
              transition: { duration: 0.55, ease: EASE_CINE },
          };

    const onSheetDragEnd = (_: unknown, info: PanInfo) => {
        if (info.offset.y > 120 || info.velocity.y > 600) setSheetOpen(false);
    };

    const content = (
        <div className={`pg-scope ${pgFontVariables}`}>
            {/* Desktop: cartão */}
            <AnimatePresence>
                {showCard && (
                    <motion.aside key="card" className="pg-dock-card" aria-label={isEn ? 'Price and booking' : 'Preço e inscrição'} {...cardMotion}>
                        {peek && (
                            <button type="button" className="pg-dock-close" onClick={() => setPeek(false)} aria-label={isEn ? 'Collapse' : 'Recolher'}>
                                <X size={16} aria-hidden />
                            </button>
                        )}
                        <PriceBlock summary={summary} isEn={isEn} />
                        <Details summary={summary} isEn={isEn} />
                        <CtaButton cta={cta} placement="pricing" className="w-full" />
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop: cápsula */}
            <AnimatePresence>
                {showPill && (
                    <motion.div key="pill" className="pg-dock-pill" {...pillMotion}>
                        <button type="button" className="pg-dock-pill-price" onClick={() => setPeek(true)} aria-label={isEn ? 'Show price details' : 'Ver detalhes do preço'}>
                            <span className="pg-meta">{isEn ? 'From' : 'Desde'}</span>
                            <span className="pg-display pg-dock-pill-value">{summary.startingEUR}</span>
                            <span className="pg-meta pg-dock-pill-more">{isEn ? 'Details' : 'Detalhes'} <ChevronUp size={13} aria-hidden /></span>
                        </button>
                        <CtaButton cta={cta} placement="sticky_bar" compact />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile: barra */}
            <AnimatePresence>
                {barVisible && (
                    <motion.div
                        key="bar"
                        ref={barRef}
                        className="pg-dock-bar js-sticky-booking-bar"
                        initial={reduce ? false : { y: '110%' }}
                        animate={{ y: '0%' }}
                        exit={{ y: '110%' }}
                        transition={{ duration: 0.5, ease: EASE_CINE }}
                    >
                        {(summary.hasIncludedInfo || summary.hasFlightInfo) && (
                            <div className={`pg-dock-bar-info ${summary.hasIncludedInfo && summary.hasFlightInfo ? 'has-two' : ''}`}>
                                {summary.hasIncludedInfo && (
                                    <button type="button" className="pg-dock-bar-chip" onClick={summary.onOpenIncluded}>
                                        <span>{isEn ? "What's included" : 'O que está incluído'}</span>
                                    </button>
                                )}
                                {summary.hasFlightInfo && (
                                    <button type="button" className="pg-dock-bar-chip" onClick={summary.onOpenFlights}>
                                        <span>{isEn ? 'Flight options' : 'Opções de voo'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="pg-dock-bar-main">
                            <button type="button" className="pg-dock-bar-price" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}>
                                <span className="pg-dock-bar-label">{isEn ? 'From / person · no flight' : 'Desde / pessoa · sem voo'}</span>
                                <span className="pg-display pg-dock-bar-value">{summary.startingEUR}</span>
                                <span className="pg-dock-bar-more">{isEn ? 'All details' : 'Todos os detalhes'} <ChevronUp size={12} aria-hidden /></span>
                            </button>
                            <CtaButton cta={cta} placement="sticky_bar" compact />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile: sheet */}
            <AnimatePresence>
                {sheetOpen && !desktop && (
                    <>
                        <motion.div
                            key="backdrop"
                            className="pg-sheet-backdrop"
                            onClick={() => setSheetOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35 }}
                        />
                        <motion.div
                            key="sheet"
                            role="dialog"
                            aria-modal="true"
                            aria-label={isEn ? 'Price and booking' : 'Preço e inscrição'}
                            className="pg-sheet"
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0.05, bottom: 0.6 }}
                            onDragEnd={onSheetDragEnd}
                            initial={reduce ? false : { y: '100%' }}
                            animate={{ y: '0%' }}
                            exit={{ y: '100%' }}
                            transition={{ duration: 0.55, ease: EASE_OUT }}
                        >
                            <span className="pg-sheet-handle" aria-hidden />
                            <button type="button" className="pg-dock-close" onClick={() => setSheetOpen(false)} aria-label={isEn ? 'Close' : 'Fechar'}>
                                <X size={16} aria-hidden />
                            </button>
                            <PriceBlock summary={summary} isEn={isEn} />
                            <Details summary={summary} isEn={isEn} onAction={() => setSheetOpen(false)} />
                            <div onClickCapture={() => setSheetOpen(false)}>
                                <CtaButton cta={cta} placement="sticky_bar" className="w-full" />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );

    return createPortal(content, document.body);
}
