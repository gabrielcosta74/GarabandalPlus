"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
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
    /** Rendered right under the amount — used for the local-currency estimate. */
    belowAmount?: ReactNode;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PaymentPreviewStep = {
    label: string;
    settles: boolean;
    applied: number;
    expected: number;
    paidBefore: number;
    paidAfter: number;
};

/**
 * Works out how a payment cascades over the deposit and the installments,
 * plus the balance left afterwards. Shared by the amount picker and the
 * payment summary so both always tell the same story.
 */
export function buildPaymentPreview({
    amount,
    paymentPlan,
    depositValue,
    paidAmount,
    maxAmount,
    isEn,
}: {
    amount: number;
    paymentPlan: Array<{ date: string; amount: number }>;
    depositValue: number;
    paidAmount: number;
    maxAmount: number;
    isEn: boolean;
}): { steps: PaymentPreviewStep[]; balanceAfter: number } | null {
    if (!Number.isFinite(amount) || amount <= 0) return null;

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

    let remainingNew = amount;
    const steps: PaymentPreviewStep[] = [];

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

    return { steps, balanceAfter: round2(Math.max(0, maxAmount - amount)) };
}

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
    belowAmount,
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

    const handleChip = (value: number) => {
        const v = round2(Math.min(Math.max(value, safeMin), safeMax));
        setInputValue(String(v).replace('.', ','));
    };

    // Keep the giant figure from overflowing on narrow phones. The size goes in an
    // inline style because globals.css sets an unlayered `input { font: inherit }`,
    // which in Tailwind v4 outranks any layered text-* utility on the input.
    const amountFontSize =
        inputValue.length > 9 ? 32
            : inputValue.length > 7 ? 40
                : 52;

    return (
        <div>
            {/* The amount itself is the input — tap the number to change it */}
            <div className="flex items-baseline justify-center gap-1.5 py-1">
                <input
                    id="custom-pay-input"
                    type="text"
                    inputMode="decimal"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={isEn ? 'Amount to pay' : 'Valor a pagar'}
                    aria-invalid={error ? true : undefined}
                    style={{
                        width: `${Math.max(inputValue.length, 1)}ch`,
                        fontSize: `${amountFontSize}px`,
                        lineHeight: 1.1,
                    }}
                    className={`min-w-[2ch] bg-transparent p-0 text-right font-black tabular-nums tracking-tight caret-amber-400 outline-none transition-colors ${
                        error ? 'text-red-400' : 'text-white'
                    }`}
                />
                <span
                    style={{ fontSize: `${amountFontSize * 0.62}px`, lineHeight: 1.1 }}
                    className={`font-bold tracking-tight ${error ? 'text-red-400/40' : 'text-white/30'}`}
                >
                    €
                </span>
            </div>

            {belowAmount}

            {/* Quick amounts — one tap covers almost everyone */}
            <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
                {chips.map((chip) => {
                    const selected = isSelectedChip(chip.value);
                    return (
                        <button
                            key={chip.value}
                            type="button"
                            onClick={() => handleChip(chip.value)}
                            aria-pressed={selected}
                            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${
                                selected
                                    ? 'bg-white font-bold text-slate-900'
                                    : 'bg-white/[0.07] font-medium text-white/70 hover:bg-white/[0.13] hover:text-white'
                            }`}
                        >
                            <span>{chip.label}</span>
                            <span className={selected ? 'text-slate-500' : 'text-white/40'}>
                                {formatPrice(chip.value)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : (
                <p className="mt-3 text-center text-sm text-white/35">
                    {isEn
                        ? `Any amount between ${formatPrice(safeMin)} and ${formatPrice(safeMax)}`
                        : `Qualquer valor entre ${formatPrice(safeMin)} e ${formatPrice(safeMax)}`}
                </p>
            )}
        </div>
    );
}
