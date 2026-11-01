"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Info, Plane } from 'lucide-react';
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
    const { formatEUR } = useCurrency();
    const isEn = locale === 'en';
    const resolvedButtonText = buttonText ?? (isWaitlist
        ? (isEn ? 'Join the waiting list' : 'Entrar na lista de espera')
        : (isEn ? 'Start registration' : 'Começar inscrição'));

    // Presentation only — values come straight from props, no amount maths here.
    const baseEUR = formatEUR(price || 0);
    const depositEUR = formatEUR(deposit || 0);
    const totalEUR = formatEUR((price || 0) + (deposit || 0));

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

    const barContent = (
        <div
            ref={barRef}
            id="UNIVERSAL_STICKY_BAR_FINAL"
            className="js-sticky-booking-bar pilgrimage-mobile-bar fixed bottom-0 left-0 z-[99999999] w-full border-t border-slate-200 bg-white/95 shadow-[0_-10px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl lg:hidden"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="pilgrimage-mobile-bar-inner">
                <div className="pilgrimage-mobile-price">
                    <span className="pilgrimage-mobile-price-label">{isEn ? 'From / person · no flight' : 'Desde / pessoa · sem voo'}</span>
                    <strong>{totalEUR}</strong>
                    <span className="pilgrimage-mobile-price-breakdown">{baseEUR} + {depositEUR} {isEn ? 'registration' : 'inscrição'}</span>
                </div>
                {(showIncludedButton || showFlightsButton) && <div className={`pilgrimage-mobile-info-row ${showIncludedButton && showFlightsButton ? 'has-two' : ''}`}>
                    {showIncludedButton && <button type="button" onClick={onOpenIncluded} className="pilgrimage-mobile-info"><Info className="h-4 w-4" aria-hidden="true" /><span>{isEn ? 'See land included' : 'Ver incluído do terrestre'}</span></button>}
                    {showFlightsButton && <button type="button" onClick={onOpenFlights} className="pilgrimage-mobile-info"><Plane className="h-4 w-4" aria-hidden="true" /><span>{isEn ? 'See flights' : 'Ver voos'}</span></button>}
                </div>}
                {onPrimaryClick ? (
                    <button type="button" onClick={onPrimaryClick} className="pilgrimage-mobile-cta btn-member group">
                        <span>{resolvedButtonText}</span><ArrowRight size={18} className="shrink-0" aria-hidden="true" />
                    </button>
                ) : (
                    <Link href={link} className="pilgrimage-mobile-cta btn-member group">
                        <span>{resolvedButtonText}</span><ArrowRight size={18} className="shrink-0" aria-hidden="true" />
                    </Link>
                )}
                <span className="sr-only">{isEn ? `Up to ${maxInstallments} instalments` : `Até ${maxInstallments} prestações`}</span>
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
