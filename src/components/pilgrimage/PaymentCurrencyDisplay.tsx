"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRightLeft, Info, LineChart, Loader2, X } from 'lucide-react';
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
    loading: () => <div className="h-[260px] animate-pulse rounded-2xl bg-slate-100" />,
});

const CURRENCY_OPTIONS = [
    { code: 'EUR' as const, flag: '🇪🇺', symbol: '€' },
    { code: 'BRL' as const, flag: '🇧🇷', symbol: 'R$' },
    { code: 'USD' as const, flag: '🇺🇸', symbol: '$' },
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

    // Keep the chart in sync when the currency is switched while the modal is open.
    useEffect(() => {
        if (!isOpen || currency === 'EUR') return;
        if (!history || history.currency !== currency) {
            void loadHistory();
        }
    }, [isOpen, currency, history, loadHistory]);

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
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                        {isEn ? 'Amount to pay' : 'Valor a pagar'}
                    </p>
                    <p className="text-xs font-semibold text-white/35">{label}</p>
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="text-3xl font-black leading-none tracking-tight text-white">
                        {formatEUR(amountInEur)}
                    </p>
                    {currency !== 'EUR' && (
                        <p className="text-base font-bold leading-none text-amber-300">
                            {isLoading || !converted
                                ? <span className="inline-block h-4 w-24 animate-pulse rounded bg-white/10 align-middle" />
                                : <>≈ {converted}</>}
                        </p>
                    )}
                </div>

                <p className="mt-2 text-sm leading-snug text-white/50">
                    {currency === 'EUR'
                        ? (isEn
                            ? 'Fixed price in euros. Pick another currency to see an estimate.'
                            : 'Preço fixo em euros. Escolhe outra moeda para veres uma estimativa.')
                        : (isEn
                            ? `Fixed price in euros. The ${currency} value is indicative — your bank sets the final rate.`
                            : `Preço fixo em euros. O valor em ${currency} é indicativo — o câmbio final é do teu banco.`)}
                </p>

                {/* Currency selector */}
                <div
                    className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-black/25 p-1.5"
                    role="group"
                    aria-label={isEn ? 'Reference currency' : 'Moeda de referência'}
                >
                    {CURRENCY_OPTIONS.map((option) => {
                        const active = option.code === currency;
                        return (
                            <button
                                key={option.code}
                                type="button"
                                onClick={() => setPreferredCurrency(option.code)}
                                aria-pressed={active}
                                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold transition ${active
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <span aria-hidden="true">{option.flag}</span>
                                {option.code}
                            </button>
                        );
                    })}
                </div>

                {currency !== 'EUR' && (
                    <button
                        type="button"
                        onClick={openModal}
                        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white transition hover:border-amber-400/40 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <LineChart className="h-4 w-4 text-amber-300" />
                        {isEn ? 'See exchange-rate variation' : 'Consultar variação do câmbio'}
                    </button>
                )}
            </section>

            {isOpen && currency !== 'EUR' && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exchange-history-title"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsOpen(false);
                    }}
                >
                    <div className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
                            <div className="min-w-0">
                                <div className="mb-1 flex items-center gap-2 text-amber-600">
                                    <ArrowRightLeft className="h-4 w-4 shrink-0" />
                                    <p className="text-xs font-black uppercase tracking-[0.14em]">
                                        EUR → {currency}
                                    </p>
                                </div>
                                <h2 id="exchange-history-title" className="text-xl font-black text-slate-900">
                                    {isEn ? 'Exchange-rate variation' : 'Variação do câmbio'}
                                </h2>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    {isEn ? 'Last 30 days · indicative' : 'Últimos 30 dias · indicativo'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                aria-label={isEn ? 'Close' : 'Fechar'}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            {historyLoading && (
                                <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-slate-500">
                                    <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                                    <p className="text-sm font-semibold">
                                        {isEn ? 'Loading exchange rates…' : 'A carregar o câmbio…'}
                                    </p>
                                </div>
                            )}

                            {historyError && !historyLoading && (
                                <div className="flex h-[300px] flex-col items-center justify-center rounded-2xl bg-slate-50 px-6 text-center">
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
                                    {/* What this amount costs today */}
                                    <div className="mb-4 rounded-2xl bg-slate-950 p-4 text-white">
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                                            {isEn ? 'This payment today' : 'Este pagamento hoje'}
                                        </p>
                                        <p className="mt-1 text-2xl font-black">
                                            {formatEUR(amountInEur)}
                                            <span className="text-white/40"> → </span>
                                            <span className="text-amber-300">≈ {converted}</span>
                                        </p>
                                        <p className="mt-1 text-sm text-white/50">
                                            1 EUR = {formatRate(stats.latest, currency)} {currency}
                                        </p>
                                    </div>

                                    <div className="mb-4 grid grid-cols-3 gap-2">
                                        <div className={`rounded-xl p-3 ${stats.change >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                            <p className="text-[11px] font-bold uppercase tracking-wide opacity-60">
                                                {isEn ? '30 days' : '30 dias'}
                                            </p>
                                            <p className="mt-0.5 text-lg font-black">
                                                {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                                {isEn ? 'Low' : 'Mínimo'}
                                            </p>
                                            <p className="mt-0.5 text-lg font-black">{formatRate(stats.min, currency)}</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                                {isEn ? 'High' : 'Máximo'}
                                            </p>
                                            <p className="mt-0.5 text-lg font-black">{formatRate(stats.max, currency)}</p>
                                        </div>
                                    </div>

                                    <ExchangeRateChart
                                        points={history.points}
                                        currency={currency}
                                        isEn={isEn}
                                    />

                                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                        <p>
                                            {history.fallback
                                                ? (isEn
                                                    ? 'Temporary reference data is being shown. Your bank determines the final conversion.'
                                                    : 'Estão a ser mostrados dados de referência temporários. O câmbio final é definido pelo teu banco.')
                                                : (isEn
                                                    ? 'Reference rates only. Your bank or card provider determines the final conversion.'
                                                    : 'Taxas apenas de referência. O câmbio final é definido pelo teu banco ou emissor do cartão.')}
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
