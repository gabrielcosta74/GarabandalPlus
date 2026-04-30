"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Info, Plane } from 'lucide-react';
// import { BrochureDownloadModal } from './BrochureDownloadModal';
import { cn } from '../../lib/utils';
import { useLocale } from '../../contexts/LocaleContext';
import { PilgrimagePrice } from './PilgrimagePrice';

type UniversalStickyBarProps = {
    price: number;
    deposit: number;
    link: string;
    isClosed: boolean;
    pilgrimageId: string;
    slug: string;
    buttonText?: string;
    depositValue?: number;
    showIncludedButton?: boolean;
    showFlightsButton?: boolean;
    onOpenIncluded?: () => void;
    onOpenFlights?: () => void;
    onPrimaryClick?: () => void;
};

export default function UniversalStickyBar({
    price,
    deposit,
    link,
    isClosed,
    buttonText,
    showIncludedButton = false,
    showFlightsButton = false,
    onOpenIncluded,
    onOpenFlights,
    onPrimaryClick
}: UniversalStickyBarProps) {
    const [mounted, setMounted] = useState(false);
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const resolvedButtonText = buttonText ?? (isEn ? 'Start Registration' : 'Iniciar Inscrição');

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    if (isClosed) {
        return null;
    }

    // Simplified Content without hidden classes first to verify visibility
    const barContent = (
        <div
            id="UNIVERSAL_STICKY_BAR_FINAL"
            className="fixed bottom-0 left-0 w-full z-[99999999] bg-white/95 border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.14)] safe-area-bottom pb-3 lg:hidden backdrop-blur-xl"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="container mx-auto px-3 py-2.5">
                <div className="flex flex-col gap-2">

                    {/* Top Row: Price and Small Info */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">{isEn ? 'Land package (no flight)' : 'Terrestre (sem voo)'}</span>
                            <div className="flex items-baseline gap-2">
                                <PilgrimagePrice
                                    amountInEur={(price || 0) + (deposit || 0)}
                                    layout="compact"
                                    primaryClassName="text-xl font-black text-slate-900 leading-none"
                                    secondaryClassName="text-sm font-bold text-slate-500"
                                    showLabels={false}
                                />
                                <span className="text-[9px] text-slate-500 font-bold leading-tight">{isEn ? '/ person' : '/ pess.'} <br/><span className="text-emerald-600 uppercase">{isEn ? 'Up to 8 instalments' : 'Ate 8x Parcelamento'}</span></span>
                            </div>
                        </div>
                    </div>

                    {(showIncludedButton || showFlightsButton) && (
                        <div className={cn("grid gap-2", showIncludedButton && showFlightsButton ? "grid-cols-2" : "grid-cols-1")}>
                            {showIncludedButton && (
                                <button
                                    type="button"
                                    onClick={onOpenIncluded}
                                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 px-2 text-[11px] font-black text-slate-800 shadow-sm transition-colors hover:bg-yellow-100"
                                >
                                    <Info className="h-3.5 w-3.5 shrink-0" />
                                    {isEn ? 'See land included' : 'Ver incluído do terrestre'}
                                </button>
                            )}
                            {showFlightsButton && (
                                <button
                                    type="button"
                                    onClick={onOpenFlights}
                                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 px-2 text-[11px] font-black text-slate-800 shadow-sm transition-colors hover:bg-yellow-100"
                                >
                                    <Plane className="h-3.5 w-3.5 shrink-0" />
                                    {isEn ? 'See flights' : 'Ver voos'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* 2. Actions (Grid for 1 button) */}
                    <div className="flex-1 grid grid-cols-1 gap-2">
                        {/* Booking area wrapper */}
                        <div className="flex w-full">
                            {onPrimaryClick ? (
                                <button
                                    type="button"
                                    onClick={onPrimaryClick}
                                    className="group flex min-h-[46px] items-center justify-center gap-2 bg-slate-950 text-white rounded-xl font-black uppercase tracking-wide shadow-lg shadow-slate-900/20 active:scale-95 transition-all w-full ring-1 ring-yellow-300/70"
                                >
                                    <span className="text-sm leading-none">{isEn ? resolvedButtonText : 'Começar Inscrição'}</span>
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-300 text-slate-950 transition-transform group-hover:translate-x-0.5">
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </span>
                                </button>
                            ) : (
                                <Link
                                    href={link}
                                    className="group flex min-h-[46px] items-center justify-center gap-2 bg-slate-950 text-white rounded-xl font-black uppercase tracking-wide shadow-lg shadow-slate-900/20 active:scale-95 transition-all w-full ring-1 ring-yellow-300/70"
                                >
                                    <span className="text-sm leading-none">{isEn ? resolvedButtonText : 'Começar Inscrição'}</span>
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-300 text-slate-950 transition-transform group-hover:translate-x-0.5">
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render directly to body
    try {
        return createPortal(barContent, document.body);
    } catch (e) {
        console.error("STICKY_BAR: Portal Error", e);
        return barContent; // Fallback to inline
    }
}
