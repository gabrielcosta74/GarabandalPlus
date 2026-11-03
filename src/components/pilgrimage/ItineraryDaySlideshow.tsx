'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import './itinerary-slideshow.css';

interface Props {
    images: string[];
    alt: string;
    dayLabel: string;
    isEn?: boolean;
    /** ms between auto-advances */
    interval?: number;
}

export default function ItineraryDaySlideshow({ images, alt, dayLabel, isEn = false, interval = 5000 }: Props) {
    const slides = images.filter(Boolean);
    const count = slides.length;
    const multiple = count > 1;

    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [zoom, setZoom] = useState(false); // lightbox open
    const reducedMotion = useRef(false);
    const touchX = useRef<number | null>(null);

    useEffect(() => {
        reducedMotion.current =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }, []);

    const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);
    const goTo = (i: number) => setIndex(i);

    // Autoplay (paused while hovering or when the lightbox is open)
    useEffect(() => {
        if (!multiple || paused || zoom || reducedMotion.current) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % count), interval);
        return () => clearInterval(id);
    }, [multiple, paused, zoom, count, interval]);

    // Lightbox: lock scroll + keyboard nav
    useEffect(() => {
        if (!zoom) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setZoom(false);
            else if (e.key === 'ArrowRight' && multiple) go(1);
            else if (e.key === 'ArrowLeft' && multiple) go(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, multiple, count]);

    if (count === 0) return null;

    const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
    };

    return (
        <>
            <div
                className="group/slide relative aspect-[4/3] w-full overflow-hidden bg-slate-900 sm:aspect-[16/9]"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                role="group"
                aria-roledescription="carousel"
                aria-label={alt}
            >
                {slides.map((src, i) => {
                    const active = i === index;
                    return (
                        <div
                            key={`${src}-${i}`}
                            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${active ? 'opacity-100' : 'opacity-0'}`}
                            aria-hidden={!active}
                        >
                            {/* Blurred fill removes grey bars for any aspect ratio */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={src}
                                alt={active ? `${alt} — ${i + 1}/${count}` : ''}
                                loading="lazy"
                                className={`relative z-10 h-full w-full object-contain ${active ? 'itn-kenburns' : ''}`}
                            />
                        </div>
                    );
                })}

                {/* Day badge */}
                <span className="absolute left-4 top-4 z-30 inline-flex items-center rounded-full bg-brand px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm shadow-brand/30">
                    {dayLabel}
                </span>

                {/* Counter + expand affordance (signals the image is tappable) */}
                <button type="button" onClick={() => setZoom(true)} aria-label={isEn ? `Expand photos for ${alt}` : `Ampliar fotografias de ${alt}`} className="absolute right-3 top-3 z-30 flex min-h-11 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {multiple && <span>{index + 1} / {count}</span>}
                    <Maximize2 className="h-4 w-4" />
                </button>

                {multiple && (
                    <>
                        {/* Arrows */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); go(-1); }}
                            aria-label={isEn ? 'Previous photo' : 'Fotografia anterior'}
                            className="absolute left-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/slide:opacity-100"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); go(1); }}
                            aria-label={isEn ? 'Next photo' : 'Fotografia seguinte'}
                            className="absolute right-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/slide:opacity-100"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>

                        {/* Dots */}
                        <div className="absolute inset-x-0 bottom-3 z-30 flex items-center justify-center gap-1.5">
                            {slides.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); goTo(i); }}
                                    aria-label={isEn ? `Go to photo ${i + 1}` : `Ir para a fotografia ${i + 1}`}
                                    aria-current={i === index ? 'true' : undefined}
                                    className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
                                ><span className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} /></button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Lightbox — full-screen, responsive, mobile-first */}
            {zoom && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-3"
                    style={{ colorScheme: 'dark' }}
                    onClick={() => setZoom(false)}
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                    role="dialog"
                    aria-modal="true"
                    aria-label={alt}
                >
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setZoom(false); }}
                        aria-label={isEn ? 'Close photos' : 'Fechar fotografias'}
                        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={slides[index]}
                        alt={`${alt} — ${index + 1}/${count}`}
                        onClick={(e) => e.stopPropagation()}
                        className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl"
                    />

                    {multiple && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); go(-1); }}
                                aria-label={isEn ? 'Previous photo' : 'Fotografia anterior'}
                                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); go(1); }}
                                aria-label={isEn ? 'Next photo' : 'Fotografia seguinte'}
                                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                            <span className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                                {index + 1} / {count}
                            </span>
                        </>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
