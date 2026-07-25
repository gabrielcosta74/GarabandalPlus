'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './itinerary-slideshow.css';

interface Props {
    images: string[];
    alt: string;
    dayLabel: string;
    /** ms between auto-advances */
    interval?: number;
}

export default function ItineraryDaySlideshow({ images, alt, dayLabel, interval = 5000 }: Props) {
    const slides = images.filter(Boolean);
    const count = slides.length;
    const multiple = count > 1;

    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const reducedMotion = useRef(false);
    const touchX = useRef<number | null>(null);

    useEffect(() => {
        reducedMotion.current =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }, []);

    const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);
    const goTo = (i: number) => setIndex(i);

    // Autoplay
    useEffect(() => {
        if (!multiple || paused || reducedMotion.current) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % count), interval);
        return () => clearInterval(id);
    }, [multiple, paused, count, interval]);

    if (count === 0) return null;

    const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
    };

    return (
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
            <span className="absolute left-4 top-4 z-30 inline-flex items-center rounded-full bg-yellow-300 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-950 shadow-sm">
                {dayLabel}
            </span>

            {multiple && (
                <>
                    {/* Counter */}
                    <span className="absolute right-4 top-4 z-30 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                        {index + 1} / {count}
                    </span>

                    {/* Arrows */}
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        aria-label="Anterior"
                        className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/70 focus:opacity-100 group-hover/slide:opacity-100"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => go(1)}
                        aria-label="Seguinte"
                        className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/70 focus:opacity-100 group-hover/slide:opacity-100"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>

                    {/* Dots */}
                    <div className="absolute inset-x-0 bottom-3 z-30 flex items-center justify-center gap-1.5">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-label={`Ir para a foto ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
