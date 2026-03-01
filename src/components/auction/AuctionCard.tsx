"use client";

import Link from 'next/link';
import { Clock, Gavel } from 'lucide-react';
import { AuctionCountdown } from './AuctionCountdown';

interface AuctionCardProps {
    item: {
        id: string;
        title: string;
        images: string[];
        starting_price: number;
        current_bid: number | null;
        total_bids: number;
        ends_at: string;
        status: string;
    };
}

export function AuctionCard({ item }: AuctionCardProps) {
    const isEnded = item.status !== 'active' || new Date(item.ends_at) <= new Date();
    const displayPrice = item.current_bid || item.starting_price;
    const hasImage = item.images && item.images.length > 0;

    return (
        <Link
            href={`/leilao/${item.id}`}
            className="group block bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300"
        >
            {/* Image */}
            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                {hasImage ? (
                    <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <Gavel className="w-12 h-12 text-slate-200" />
                    </div>
                )}

                {/* Status Badge */}
                {isEnded ? (
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                        Encerrado
                    </div>
                ) : (
                    <div className="absolute top-3 left-3 bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Em Leilão
                    </div>
                )}

                {/* Bids count */}
                {item.total_bids > 0 && (
                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                        {item.total_bids} {item.total_bids === 1 ? 'lance' : 'lances'}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-bold text-slate-900 text-lg mb-2 group-hover:text-yellow-700 transition-colors line-clamp-2 leading-tight">
                    {item.title}
                </h3>

                <div className="flex items-end justify-between gap-2">
                    <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-0.5">
                            {item.current_bid ? 'Lance atual' : 'Valor mínimo'}
                        </span>
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">
                            {(displayPrice / 100).toFixed(0)}€
                        </span>
                    </div>

                    {!isEnded && (
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-1 justify-end mb-0.5">
                                <Clock className="w-3 h-3" /> Termina em
                            </span>
                            <AuctionCountdown endsAt={item.ends_at} className="text-sm" />
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
