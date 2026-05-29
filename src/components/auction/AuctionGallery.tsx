"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

type Slide = { kind: 'image' | 'video'; url: string };

interface AuctionGalleryProps {
    images: string[];
    videos?: string[];
    title: string;
}

export function AuctionGallery({ images, videos = [], title }: AuctionGalleryProps) {
    const slides: Slide[] = [
        ...(images || []).map((url) => ({ kind: 'image' as const, url })),
        ...(videos || []).map((url) => ({ kind: 'video' as const, url })),
    ];
    const [current, setCurrent] = useState(0);

    if (slides.length === 0) {
        return (
            <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center">
                <span className="text-slate-300 text-sm">Sem imagem</span>
            </div>
        );
    }

    const prev = () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
    const next = () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));
    const active = slides[current];

    return (
        <div className="relative">
            {/* Main media */}
            <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative group">
                {active.kind === 'image' ? (
                    <img
                        src={active.url}
                        alt={`${title} - imagem ${current + 1}`}
                        className="w-full h-full object-cover transition-transform duration-500"
                    />
                ) : (
                    <video
                        key={active.url}
                        src={active.url}
                        controls
                        playsInline
                        className="w-full h-full object-cover bg-black"
                    />
                )}

                {slides.length > 1 && (
                    <>
                        <button
                            onClick={prev}
                            aria-label="Anterior"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={next}
                            aria-label="Seguinte"
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </>
                )}

                {slides.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                        {current + 1} / {slides.length}
                    </div>
                )}
            </div>

            {/* Thumbnails */}
            {slides.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                    {slides.map((slide, idx) => (
                        <button
                            key={`${slide.kind}-${idx}`}
                            onClick={() => setCurrent(idx)}
                            className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${idx === current
                                ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                                : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                        >
                            {slide.kind === 'image' ? (
                                <img src={slide.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <video src={slide.url} muted playsInline preload="metadata" className="w-full h-full object-cover bg-black" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <Play className="w-4 h-4 text-white drop-shadow" fill="currentColor" />
                                    </span>
                                </>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
