"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRightLeft, Info, Loader2, TrendingUp, X } from 'lucide-react';
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
    loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 sm:h-72" />,
});

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
                <span className={`text-[10px] md:text-xs font-semibold text-slate-400 ${convertedClassName}`}>
                    ≈ {converted} · {isEn ? 'indicative' : 'indicativo'}
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
    const { currency, formatEUR, formatConverted, isLoading } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<HistoryResponse | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState(false);
    const converted = formatConverted(amountInEur);

    const loadHistory = useCallback(async () => {
        if (currency === 'EUR') return;
        setHistoryLoading(true);
        setHistoryError(false);
        try {
            const response = await fetch(`/api/exchange-rate/history?currency=${currency}&days=30`);
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
    }, [currency]);

    const openModal = () => {
        setIsOpen(true);
        if (!history || history.currency !== currency) {
            void loadHistory();
        }
    };

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
        const change = ((latest - first) / first) * 100;
        return {
            latest,
            change,
            min: Math.min(...points.map((point) => point.rate)),
            max: Math.max(...points.map((point) => point.rate)),
        };
    }, [history]);

    return (
        <>
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-inner">
                <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    {label}
                </p>
                <div className={`grid gap-2 ${converted ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                            {isEn ? 'Fixed price · EUR' : 'Preço fixo · EUR'}
                        </p>
                        <p className="mt-1 break-words text-xl font-black text-white sm:text-2xl">
                            {formatEUR(amountInEur)}
                        </p>
                    </div>

                    {converted && (
                        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.08] p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                {isEn ? `Estimate · ${currency}` : `Estimativa · ${currency}`}
                            </p>
                            <p className="mt-1 break-words text-xl font-black text-white sm:text-2xl">
                                ≈ {converted}
                            </p>
                        </div>
                    )}
                </div>

                {!isLoading && converted && (
                    <>
                        <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
                            <p>
                                {isEn
                                    ? 'You will always be charged in EUR. The local value is indicative and may vary.'
                                    : 'A cobrança é sempre feita em EUR. O valor local é indicativo e pode variar.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={openModal}
                            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-2.5 text-xs font-bold text-white transition hover:border-amber-400/30 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <TrendingUp className="h-4 w-4 text-amber-300" />
                            {isEn ? 'View exchange-rate variation' : 'Consultar variação cambial'}
                        </button>
                    </>
                )}
            </div>

            {isOpen && currency !== 'EUR' && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exchange-history-title"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsOpen(false);
                    }}
                >
                    <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white shadow-2xl sm:max-w-xl sm:rounded-[1.75rem]">
                        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                            <div>
                                <div className="mb-1 flex items-center gap-2 text-amber-600">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                                        EUR → {currency}
                                    </p>
                                </div>
                                <h2 id="exchange-history-title" className="text-xl font-black text-slate-900 sm:text-2xl">
                                    {isEn ? 'Exchange-rate variation' : 'Variação cambial'}
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {isEn ? 'Indicative values from the last 30 days' : 'Valores indicativos dos últimos 30 dias'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                aria-label={isEn ? 'Close' : 'Fechar'}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 sm:p-6">
                            {historyLoading && (
                                <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
                                    <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                                    <p className="text-sm font-semibold">
                                        {isEn ? 'Loading exchange-rate history…' : 'A carregar histórico cambial…'}
                                    </p>
                                </div>
                            )}

                            {historyError && !historyLoading && (
                                <div className="flex h-64 flex-col items-center justify-center rounded-2xl bg-slate-50 px-6 text-center">
                                    <p className="font-bold text-slate-800">
                                        {isEn ? 'History is temporarily unavailable.' : 'O histórico está temporariamente indisponível.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void loadHistory()}
                                        className="mt-4 min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white"
                                    >
                                        {isEn ? 'Try again' : 'Tentar novamente'}
                                    </button>
                                </div>
                            )}

                            {history && stats && !historyLoading && (
                                <>
                                    <div className="mb-5 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-slate-950 p-4 text-white">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                                                {isEn ? 'Current reference' : 'Referência atual'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black">
                                                {formatRate(stats.latest, currency)}
                                            </p>
                                            <p className="text-[11px] text-white/50">1 EUR = {currency}</p>
                                        </div>
                                        <div className={`rounded-2xl p-4 ${stats.change >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                                                {isEn ? '30-day change' : 'Variação em 30 dias'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black">
                                                {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%
                                            </p>
                                            <p className="text-[11px] opacity-60">
                                                {isEn ? 'Against the euro' : 'Face ao euro'}
                                            </p>
                                        </div>
                                    </div>

                                    <ExchangeRateChart
                                        points={history.points}
                                        currency={currency}
                                        isEn={isEn}
                                    />

                                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                        <p>
                                            {history.fallback
                                                ? (isEn
                                                    ? 'Temporary reference data is being shown. Your bank determines the final conversion.'
                                                    : 'Estão a ser mostrados dados de referência temporários. O câmbio final é definido pelo seu banco.')
                                                : (isEn
                                                    ? 'Reference rates only. Your bank or card provider determines the final conversion.'
                                                    : 'Taxas apenas de referência. O câmbio final é definido pelo seu banco ou emissor do cartão.')}
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
