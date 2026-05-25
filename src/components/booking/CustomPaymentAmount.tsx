"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

interface CustomPaymentAmountProps {
    suggestedAmount: number;
    minAmount: number;
    maxAmount: number;
    minLabel: string;
    paymentPlan: Array<{ date: string; amount: number }>;
    depositValue: number;
    paidAmount: number;
    formatPrice: (value: number) => string;
    active: boolean;
    customAmount: number | null;
    onChange: (amount: number | null) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function CustomPaymentAmount({
    suggestedAmount,
    minAmount,
    maxAmount,
    minLabel,
    paymentPlan,
    depositValue,
    paidAmount,
    formatPrice,
    active,
    customAmount,
    onChange,
}: CustomPaymentAmountProps) {
    const { locale } = useLocale();
    const isEn = locale === 'en';

    const safeMin = round2(Math.max(0, minAmount));
    const safeMax = round2(Math.max(0, maxAmount));

    // Initialise input with current custom amount (if any) or the suggested one.
    const initial = active && customAmount != null ? customAmount : suggestedAmount;
    const [inputValue, setInputValue] = useState<string>(
        String(round2(initial)).replace('.', ',')
    );

    // Keep input in sync when the suggested amount changes externally (e.g. after a refresh)
    // but only while the user has not typed something different.
    const lastSuggestedRef = useRef(suggestedAmount);
    useEffect(() => {
        if (lastSuggestedRef.current !== suggestedAmount && !active) {
            setInputValue(String(round2(suggestedAmount)).replace('.', ','));
            lastSuggestedRef.current = suggestedAmount;
        }
    }, [suggestedAmount, active]);

    const parsed = useMemo(() => {
        const cleaned = inputValue.trim().replace(/\s+/g, '').replace(',', '.');
        if (!cleaned) return null;
        const n = Number(cleaned);
        if (!Number.isFinite(n)) return null;
        return round2(n);
    }, [inputValue]);

    const error: string | null = useMemo(() => {
        if (parsed === null) return null;
        if (parsed <= 0) {
            return isEn ? 'Enter a valid amount.' : 'Introduz um valor válido.';
        }
        if (parsed < safeMin - 0.009) {
            return isEn
                ? `Minimum is ${formatPrice(safeMin)} (${minLabel}).`
                : `O mínimo é ${formatPrice(safeMin)} (${minLabel}).`;
        }
        if (parsed > safeMax + 0.009) {
            return isEn
                ? `Maximum is ${formatPrice(safeMax)} (outstanding).`
                : `O máximo é ${formatPrice(safeMax)} (saldo em falta).`;
        }
        return null;
    }, [parsed, safeMin, safeMax, formatPrice, isEn, minLabel]);

    const valid = parsed !== null && !error;

    // Push the effective custom amount up to the parent. Only mark it as "custom"
    // (i.e. different from the suggested default) when the value actually differs.
    useEffect(() => {
        if (valid && parsed != null) {
            const isDifferentFromSuggested = Math.abs(parsed - suggestedAmount) > 0.009;
            onChange(isDifferentFromSuggested ? parsed : null);
        } else {
            onChange(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsed, valid, suggestedAmount]);

    // Build dynamic chips: next installment, +1, +2, all.
    const chips = useMemo(() => {
        const next = safeMin;
        const items: Array<{ label: string; value: number; tone: 'default' | 'gold' }> = [];
        items.push({
            label: isEn ? 'Next' : 'Próxima',
            value: round2(next),
            tone: 'default',
        });
        if (paymentPlan.length >= 2 && next * 2 <= safeMax + 0.009) {
            items.push({
                label: isEn ? '+1 installment' : '+1 prestação',
                value: round2(Math.min(next * 2, safeMax)),
                tone: 'default',
            });
        }
        if (paymentPlan.length >= 3 && next * 3 <= safeMax + 0.009) {
            items.push({
                label: isEn ? '+2 installments' : '+2 prestações',
                value: round2(Math.min(next * 3, safeMax)),
                tone: 'default',
            });
        }
        items.push({
            label: isEn ? 'Pay all' : 'Tudo',
            value: round2(safeMax),
            tone: 'gold',
        });
        // Deduplicate by value
        const seen = new Set<number>();
        return items.filter((it) => {
            if (seen.has(it.value)) return false;
            seen.add(it.value);
            return true;
        });
    }, [paymentPlan.length, safeMin, safeMax, isEn]);

    const isSelectedChip = (val: number) => parsed != null && Math.abs(parsed - val) < 0.009;

    const preview = useMemo(() => {
        if (!valid || parsed == null) return null;

        const sequence: Array<{ label: string; expected: number }> = [
            { label: isEn ? 'Registration deposit' : 'Sinal de inscrição', expected: depositValue },
            ...paymentPlan.map((p, idx) => ({
                label: `${isEn ? 'Installment' : 'Prestação'} ${idx + 1}`,
                expected: Number(p.amount) || 0,
            })),
        ];

        let remainingPaid = paidAmount;
        const alreadyCovered: number[] = sequence.map(({ expected }) => {
            const used = Math.min(remainingPaid, expected);
            remainingPaid -= used;
            return used;
        });

        let remainingNew = parsed;
        const steps: Array<{
            label: string;
            settles: boolean;
            applied: number;
            expected: number;
            paidBefore: number;
            paidAfter: number;
        }> = [];

        for (let i = 0; i < sequence.length; i++) {
            if (remainingNew <= 0.0001) break;
            const { label, expected } = sequence[i];
            const before = alreadyCovered[i];
            const stillNeeded = Math.max(0, expected - before);
            if (stillNeeded <= 0.0001) continue;
            const apply = Math.min(remainingNew, stillNeeded);
            remainingNew = round2(remainingNew - apply);
            const after = round2(before + apply);
            steps.push({
                label,
                expected,
                paidBefore: before,
                paidAfter: after,
                applied: round2(apply),
                settles: after >= expected - 0.009,
            });
        }

        const balanceAfter = round2(Math.max(0, safeMax - parsed));
        return { steps, balanceAfter };
    }, [valid, parsed, paymentPlan, depositValue, paidAmount, safeMax, isEn]);

    const handleChip = (value: number) => {
        const v = round2(Math.min(Math.max(value, safeMin), safeMax));
        setInputValue(String(v).replace('.', ','));
    };

    return (
        <div className="space-y-3">
            {/* Label */}
            <div className="flex items-center justify-between">
                <label htmlFor="custom-pay-input" className="block text-[11px] font-bold uppercase tracking-widest text-white/70">
                    {isEn ? 'Amount to pay' : 'Valor a pagar'}
                </label>
                <span className="text-[11px] text-white/40">
                    {isEn ? `Max ${formatPrice(safeMax)}` : `Máx ${formatPrice(safeMax)}`}
                </span>
            </div>

            {/* Input with € suffix */}
            <div className="relative">
                <input
                    id="custom-pay-input"
                    type="text"
                    inputMode="decimal"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    className={`w-full bg-white text-slate-900 font-bold text-3xl md:text-4xl pl-5 pr-12 py-4 rounded-2xl border-2 outline-none transition-colors ${
                        error
                            ? 'border-red-400 focus:border-red-500'
                            : valid
                                ? 'border-green-400 focus:border-green-500'
                                : 'border-transparent focus:border-yellow-400'
                    }`}
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-2xl md:text-3xl pointer-events-none">€</span>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2">
                {chips.map((chip) => {
                    const selected = isSelectedChip(chip.value);
                    const baseClasses = 'text-xs font-bold px-3 py-2 rounded-xl transition-colors text-center flex-1 min-w-[80px]';
                    const toneClasses = chip.tone === 'gold'
                        ? selected
                            ? 'bg-yellow-400 text-slate-900 ring-2 ring-yellow-300'
                            : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200'
                        : selected
                            ? 'bg-white text-slate-900 ring-2 ring-white/60'
                            : 'bg-white/10 hover:bg-white/20 text-white';
                    return (
                        <button
                            key={chip.value}
                            type="button"
                            onClick={() => handleChip(chip.value)}
                            className={`${baseClasses} ${toneClasses}`}
                        >
                            <span className="block leading-tight">{chip.label}</span>
                            <span className="block leading-tight text-[11px] opacity-80">{formatPrice(chip.value)}</span>
                        </button>
                    );
                })}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 text-xs text-red-200 bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Preview */}
            {valid && preview && (
                <details className="rounded-xl bg-white/5 border border-white/10 overflow-hidden group">
                    <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5">
                        <span>{isEn ? 'How it will be applied' : 'Como será aplicado'}</span>
                        <span className="text-white/40 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="px-3 pb-3 pt-1 space-y-2">
                        <ul className="space-y-1.5">
                            {preview.steps.map((s, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-white">
                                    <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                            s.settles ? 'bg-green-500/30 text-green-200' : 'bg-amber-500/30 text-amber-200'
                                        }`}
                                    >
                                        {s.settles ? <Check className="w-3 h-3" /> : '↑'}
                                    </span>
                                    <span className="flex-1">
                                        {s.settles
                                            ? (isEn
                                                ? `Settles ${s.label} (${formatPrice(s.expected)})`
                                                : `Liquida ${s.label} (${formatPrice(s.expected)})`)
                                            : (isEn
                                                ? `Advances ${formatPrice(s.applied)} of ${s.label} — ${formatPrice(round2(s.expected - s.paidAfter))} still due`
                                                : `Adianta ${formatPrice(s.applied)} de ${s.label} — falta ${formatPrice(round2(s.expected - s.paidAfter))}`)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="pt-2 mt-1 border-t border-white/10 flex items-center justify-between text-xs">
                            <span className="text-white/60">
                                {isEn ? 'Balance after payment' : 'Saldo após pagamento'}
                            </span>
                            <span className="font-bold text-white">{formatPrice(preview.balanceAfter)}</span>
                        </div>
                    </div>
                </details>
            )}
        </div>
    );
}
