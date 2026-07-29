"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Info, Plane } from 'lucide-react';
// import { BrochureDownloadModal } from './BrochureDownloadModal';
import { cn } from '../../lib/utils';
import { useLocale } from '../../contexts/LocaleContext';
import { useCurrency } from '../providers/CurrencyProvider';

type UniversalStickyBarProps = {
    price: number;
    deposit: number;
    link: string;
    isClosed: boolean;
    /** Registrations are full but the waiting list is open — the bar stays up. */
    isWaitlist?: boolean;
    pilgrimageId: string;
    slug: string;
    buttonText?: string;
    depositValue?: number;
    showIncludedButton?: boolean;
    showFlightsButton?: boolean;
    onOpenIncluded?: () => void;
    onOpenFlights?: () => void;
    onPrimaryClick?: () => void;
    maxInstallments?: number;
};

export default function UniversalStickyBar({
    price,
    deposit,
    link,
    isClosed,
    isWaitlist = false,
    buttonText,
    showIncludedButton = false,
    showFlightsButton = false,
    onOpenIncluded,
    onOpenFlights,
    onPrimaryClick,
    maxInstallments = 8,
}: UniversalStickyBarProps) {
    const [mounted, setMounted] = useState(false);
    const { locale } = useLocale();
    const { formatEUR, formatConverted } = useCurrency();
    const isEn = locale === 'en';
    const resolvedButtonText = buttonText ?? (isWaitlist
        ? (isEn ? 'Join the waiting list' : 'Entrar na lista de espera')
        : (isEn ? 'Start registration' : 'Começar inscrição'));

    // Presentation only — values come straight from props, no amount maths here.
    const baseEUR = formatEUR(price || 0);
    const depositEUR = formatEUR(deposit || 0);
    const totalConverted = formatConverted((price || 0) + (deposit || 0));

    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Publish the bar's real height so floating elements (the chat FAB) can sit
    // above it without magic numbers — the bar grows and shrinks with its content.
    useEffect(() => {
        const el = barRef.current;
        const root = document.documentElement;
        if (!el) {
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
    }, [mounted, isClosed, isWaitlist]);

    if (!mounted) {
        return null;
    }

    // Closed hides the bar; a full pilgrimage with an open waiting list keeps it,
    // so people still see the price, the flights and a way in.
    if (isClosed && !isWaitlist) {
        return null;
    }

    // Simplified Content without hidden classes first to verify visibility
    const barContent = (
        <div
            ref={barRef}
            id="UNIVERSAL_STICKY_BAR_FINAL"
            className="js-sticky-booking-bar fixed bottom-0 left-0 w-full z-[99999999] bg-white/95 border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.14)] safe-area-bottom pb-3 lg:hidden backdrop-blur-xl transition-opacity duration-200"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="container mx-auto px-3 py-2.5">
                <div className="flex flex-col gap-2">

                    {/* Top Row: Price breakdown (base + registration), per person */}
                    <div className="border-b border-slate-100 pb-2">
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                            {isEn ? 'Land package (no flight) · per person' : 'Terrestre (sem voo) · por pessoa'}
                        </span>
                        <div className="mt-1 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                            <span className="text-2xl font-black text-slate-900 leading-none">{baseEUR}</span>
                            <span className="text-sm font-bold text-slate-600 leading-none">
                                + {depositEUR} {isEn ? 'registration' : 'inscrição'}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {totalConverted && (
                                <span className="text-xs font-semibold text-slate-500">
                                    ≈ {totalConverted} {isEn ? '(variable)' : '(variável)'}
                                </span>
                            )}
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                                {isEn ? `Up to ${maxInstallments} instalments` : `Até ${maxInstallments} prestações`}
                            </span>
                        </div>
                    </div>

                    {(showIncludedButton || showFlightsButton) && (
                        <div className={cn("grid gap-2", showIncludedButton && showFlightsButton ? "grid-cols-2" : "grid-cols-1")}>
                            {showIncludedButton && (
                                <button
                                    type="button"
                                    onClick={onOpenIncluded}
                                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-[10px] font-black leading-tight tracking-tight text-slate-800 shadow-sm transition-colors hover:bg-yellow-100 whitespace-nowrap"
                                >
                                    <Info className="h-3.5 w-3.5 shrink-0" />
                                    {isEn ? 'See land included' : 'Ver incluído do terrestre'}
                                </button>
                            )}
                            {showFlightsButton && (
                                <button
                                    type="button"
                                    onClick={onOpenFlights}
                                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-[10px] font-black leading-tight tracking-tight text-slate-800 shadow-sm transition-colors hover:bg-yellow-100 whitespace-nowrap"
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
                                    className="group flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 px-4 shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
                                >
                                    <span className="text-[17px] font-black tracking-tight leading-none text-slate-950">{resolvedButtonText}</span>
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white transition-transform group-hover:translate-x-0.5">
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </span>
                                </button>
                            ) : (
                                <Link
                                    href={link}
                                    className="group flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 px-4 shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
                                >
                                    <span className="text-[17px] font-black tracking-tight leading-none !text-slate-950">{resolvedButtonText}</span>
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 !text-white transition-transform group-hover:translate-x-0.5">
                                        <ArrowRight className="h-3.5 w-3.5" />
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
