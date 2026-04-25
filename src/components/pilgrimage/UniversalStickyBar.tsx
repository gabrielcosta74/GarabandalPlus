"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Download, Info, Plane } from 'lucide-react';
// import { BrochureDownloadModal } from './BrochureDownloadModal';
import { cn } from '../../lib/utils';
import { useCurrency } from '../providers/CurrencyProvider';
import { useLocale } from '../../contexts/LocaleContext';

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
    const { formatPrice } = useCurrency();
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
            className="fixed bottom-0 left-0 w-full z-[99999999] bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] safe-area-bottom pb-6 xl:hidden"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="container mx-auto px-4 py-4">
                <div className="flex flex-col gap-3">

                    {/* Top Row: Price and Small Info */}
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <div className="flex flex-col">
                            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-widest">{isEn ? 'Land package (no flight)' : 'Terrestre (sem voo)'}</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-900 leading-none">{formatPrice((price || 0) + (deposit || 0))}</span>
                                <span className="text-[10px] text-slate-500 font-bold leading-tight">{isEn ? '/ person' : '/ pess.'} <br/><span className="text-emerald-600 uppercase">{isEn ? 'Up to 8 instalments' : 'Ate 8x Parcelamento'}</span></span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-bold uppercase tracking-tight border border-green-100">
                                <Download className="w-3 h-3" /> {isEn ? 'Programme Available' : 'Programa Disponível'}
                            </span>
                        </div>
                    </div>

                    {(showIncludedButton || showFlightsButton) && (
                        <div className={cn("grid gap-2", showIncludedButton && showFlightsButton ? "grid-cols-2" : "grid-cols-1")}>
                            {showIncludedButton && (
                                <button
                                    type="button"
                                    onClick={onOpenIncluded}
                                    className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition-colors"
                                >
                                    <Info className="h-4 w-4" />
                                    {isEn ? 'Included in land package' : 'Incluído no terrestre'}
                                </button>
                            )}
                            {showFlightsButton && (
                                <button
                                    type="button"
                                    onClick={onOpenFlights}
                                    className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition-colors"
                                >
                                    <Plane className="h-4 w-4" />
                                    {isEn ? 'Flights' : 'Voos'}
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
                                    className="flex items-center justify-center gap-2 h-14 bg-yellow-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-tight shadow-xl shadow-yellow-500/20 active:scale-95 transition-all w-full border-b-4 border-yellow-600"
                                >
                                    <span>{resolvedButtonText}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <Link
                                    href={link}
                                    className="flex items-center justify-center gap-2 h-14 bg-yellow-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-tight shadow-xl shadow-yellow-500/20 active:scale-95 transition-all w-full border-b-4 border-yellow-600"
                                >
                                    <span>{resolvedButtonText}</span>
                                    <ArrowRight className="w-4 h-4" />
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
