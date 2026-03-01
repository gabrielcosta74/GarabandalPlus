"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AuctionGalleryProps {
    images: string[];
    title: string;
}

export function AuctionGallery({ images, title }: AuctionGalleryProps) {
    const [current, setCurrent] = useState(0);

    if (!images || images.length === 0) {
        return (
            <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center">
                <span className="text-slate-300 text-sm">Sem imagem</span>
            </div>
        );
    }

    const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
    const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

    return (
        <div className="relative">
            {/* Main Image */}
            <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative group">
                <img
                    src={images[current]}
                    alt={`${title} - imagem ${current + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500"
                />

                {/* Navigation arrows */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={prev}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={next}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                        {current + 1} / {images.length}
                    </div>
                )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrent(idx)}
                            className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${idx === current
                                    ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                        >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
