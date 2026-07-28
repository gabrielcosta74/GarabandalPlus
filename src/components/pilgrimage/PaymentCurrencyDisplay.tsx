"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, ChevronDown, Info, Loader2, X } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';

export type HistoryPoint = {
    date: string;
    rate: number;
};

type HistoryResponse = {
    currency: 'BRL' | 'USD';
    points: HistoryPoint[];
    fallback?: boolean;
};

type PaymentCurrencyDisplayProps = {
    amountInEur: number;
    label: string;
    isEn?: boolean;
};

const ExchangeRateChart = dynamic(() => import('./ExchangeRateChart'), {
    ssr: false,
    loading: () => <div className="h-[220px] animate-pulse rounded-2xl bg-white/5" />,
});

const CURRENCY_OPTIONS = [
    { code: 'EUR' as const, flag: '🇪🇺', pt: 'Euro', en: 'Euro' },
    { code: 'BRL' as const, flag: '🇧🇷', pt: 'Real brasileiro', en: 'Brazilian real' },
    { code: 'USD' as const, flag: '🇺🇸', pt: 'Dólar americano', en: 'US dollar' },
];

const formatRate = (rate: number, currency: string) =>
    new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
        minimumFractionDigits: currency === 'BRL' ? 2 : 3,
        maximumFractionDigits: currency === 'BRL' ? 2 : 3,
    }).format(rate);

export function LocalizedPilgrimageAmount({
    amountInEur,
    isEn = false,
    className = '',
    eurClassName = '',
    convertedClassName = '',
}: {
    amountInEur: number;
    isEn?: boolean;
    className?: string;
    eurClassName?: string;
    convertedClassName?: string;
}) {
    const { formatEUR, formatConverted, currency, isLoading } = useCurrency();
    const converted = formatConverted(amountInEur);

    return (
        <span className={`inline-flex flex-col ${className}`}>
            <span className={eurClassName}>{formatEUR(amountInEur)}</span>
            {!isLoading && converted && (
                <span className={`text-xs font-semibold text-slate-400 ${convertedClassName}`}>
                    ≈ {converted}
                </span>
            )}
            <span className="sr-only">
                {currency === 'EUR'
                    ? (isEn ? 'Fixed price in euros' : 'Preço fixo em euros')
                    : (isEn ? `Indicative conversion to ${currency}` : `Conversão indicativa para ${currency}`)}
            </span>
        </span>
    );
}

export default function PaymentCurrencyDisplay({
    amountInEur,
    label,
    isEn = false,
}: PaymentCurrencyDisplayProps) {
    const { currency, formatEUR, formatConverted, isLoading, setPreferredCurrency } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<HistoryResponse | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState(false);
    const converted = formatConverted(amountInEur);

    const loadHistory = useCallback(async (target: string) => {
        if (target === 'EUR') return;
        setHistoryLoading(true);
        setHistoryError(false);
        try {
            const response = await fetch(`/api/exchange-rate/history?currency=${target}&days=30`);
            const data = await response.json();
            if (!response.ok || !Array.isArray(data?.points) || data.points.length < 2) {
                throw new Error('Invalid exchange-rate history');
            }
            setHistory(data);
        } catch {
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    // Load (or reload) the chart whenever the sheet is open on a non-euro currency.
    useEffect(() => {
        if (!isOpen || currency === 'EUR') return;
        if (history?.currency === currency || historyLoading) return;
        void loadHistory(currency);
    }, [isOpen, currency, history, historyLoading, loadHistory]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen]);

    const stats = useMemo(() => {
        const points = history?.points || [];
        if (points.length < 2) return null;
        const first = points[0].rate;
        const latest = points[points.length - 1].rate;
        return {
            latest,
            change: ((latest - first) / first) * 100,
            min: Math.min(...points.map((point) => point.rate)),
            max: Math.max(...points.map((point) => point.rate)),
        };
    }, [history]);

    const showChart = currency !== 'EUR' && history?.currency === currency && stats && !historyLoading;

    return (
        <>
            {/* Quiet trigger, sits right under the amount */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="mx-auto flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-white/45 transition-colors hover:bg-white/5 hover:text-white/80"
            >
                {currency === 'EUR' ? (
                    <span>{isEn ? 'See in another currency' : 'Ver noutra moeda'}</span>
                ) : isLoading || !converted ? (
                    <span className="inline-block h-3.5 w-28 animate-pulse rounded bg-white/10" />
                ) : (
                    <span>≈ {converted}</span>
                )}
                <ChevronDown className="h-4 w-4" />
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="currency-sheet-title"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsOpen(false);
                    }}
                >
                    <div className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-[#0d1117] shadow-2xl sm:max-w-md sm:rounded-3xl">
                        {/* Grab handle */}
                        <div className="flex justify-center pt-3 sm:hidden">
                            <div className="h-1 w-10 rounded-full bg-white/15" />
                        </div>

                        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4">
                            <div className="min-w-0">
                                <h2 id="currency-sheet-title" className="text-xl font-bold text-white">
                                    {isEn ? 'Currency' : 'Moeda'}
                                </h2>
                                <p className="mt-0.5 text-sm text-white/45">
                                    {isEn ? `${label} · ${formatEUR(amountInEur)}` : `${label} · ${formatEUR(amountInEur)}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/60 transition hover:bg-white/[0.14] hover:text-white"
                                aria-label={isEn ? 'Close' : 'Fechar'}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Currency picker */}
                        <div className="px-3">
                            {CURRENCY_OPTIONS.map((option) => {
                                const active = option.code === currency;
                                return (
                                    <button
                                        key={option.code}
                                        type="button"
                                        onClick={() => setPreferredCurrency(option.code)}
                                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                                            active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        <span className="text-2xl" aria-hidden="true">{option.flag}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-base font-semibold text-white">{option.code}</span>
                                            <span className="block text-sm text-white/40">
                                                {isEn ? option.en : option.pt}
                                            </span>
                                        </span>
                                        {active && <Check className="h-5 w-5 shrink-0 text-amber-400" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="px-5 pb-6 pt-4">
                            {currency === 'EUR' ? (
                                <p className="rounded-2xl bg-white/[0.04] p-4 text-sm leading-relaxed text-white/50">
                                    {isEn
                                        ? 'The price is set in euros. Pick another currency to see an estimate and how the rate has moved.'
                                        : 'O preço está definido em euros. Escolhe outra moeda para veres uma estimativa e a variação do câmbio.'}
                                </p>
                            ) : (
                                <>
                                    <div className="mb-4 rounded-2xl bg-white/[0.04] p-4">
                                        <p className="text-sm text-white/45">
                                            {isEn ? 'Estimated value' : 'Valor estimado'}
                                        </p>
                                        <p className="mt-1 text-2xl font-black text-white">
                                            {converted ? `≈ ${converted}` : (
                                                <span className="inline-block h-6 w-32 animate-pulse rounded bg-white/10" />
                                            )}
                                        </p>
                                        {stats && (
                                            <p className="mt-1.5 text-sm text-white/40">
                                                1 EUR = {formatRate(stats.latest, currency)} {currency}
                                                <span className={stats.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                    {' · '}{stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}% {isEn ? '30d' : '30d'}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    {historyLoading && (
                                        <div className="flex h-[220px] items-center justify-center gap-2 text-sm text-white/40">
                                            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                                            {isEn ? 'Loading rates…' : 'A carregar o câmbio…'}
                                        </div>
                                    )}

                                    {historyError && !historyLoading && (
                                        <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-2xl bg-white/[0.04] text-center">
                                            <p className="px-6 text-sm text-white/60">
                                                {isEn ? 'Rate history is unavailable right now.' : 'O histórico do câmbio está indisponível.'}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => void loadHistory(currency)}
                                                className="min-h-10 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
                                            >
                                                {isEn ? 'Try again' : 'Tentar novamente'}
                                            </button>
                                        </div>
                                    )}

                                    {showChart && history && (
                                        <>
                                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/35">
                                                {isEn ? 'Last 30 days' : 'Últimos 30 dias'}
                                            </p>
                                            <ExchangeRateChart
                                                points={history.points}
                                                currency={currency}
                                                isEn={isEn}
                                            />
                                        </>
                                    )}

                                    <div className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-white/40">
                                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" />
                                        <p>
                                            {isEn
                                                ? 'You are always charged in euros. This estimate is a reference — your bank sets the final rate.'
                                                : 'A cobrança é sempre em euros. Esta estimativa é uma referência — o câmbio final é do teu banco.'}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
