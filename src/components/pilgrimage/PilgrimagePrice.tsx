"use client";

import { useCurrency } from '../providers/CurrencyProvider';
import { useLocale } from '../../contexts/LocaleContext';
import { cn } from '../../lib/utils';

type Layout = 'stacked' | 'inline' | 'compact' | 'showcase';

type PilgrimagePriceProps = {
    amountInEur: number;
    layout?: Layout;
    primaryClassName?: string;
    secondaryClassName?: string;
    fixedLabelClassName?: string;
    variableLabelClassName?: string;
    className?: string;
    showLabels?: boolean;
};

/**
 * Displays the EUR price as the fixed/contract price, with the user's local currency
 * (BRL/USD) shown alongside as a "variable" price when applicable. Brazilian and US
 * users were getting confused thinking the converted price was the contract price —
 * EUR is always primary, conversions are explicitly labelled as variable.
 */
export function PilgrimagePrice({
    amountInEur,
    layout = 'stacked',
    primaryClassName,
    secondaryClassName,
    fixedLabelClassName,
    variableLabelClassName,
    className,
    showLabels = true,
}: PilgrimagePriceProps) {
    const { formatEUR, formatConverted, currency } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';

    const fixed = formatEUR(amountInEur);
    const variable = formatConverted(amountInEur);

    const fixedLabel = isEn ? 'Fixed price' : 'Preço fixo';
    const variableLabel = isEn
        ? `Variable price (${currency} — today's rate)`
        : `Preço variável (${currency} — câmbio do dia)`;

    if (!variable) {
        return (
            <span className={cn('inline-flex flex-col', className)}>
                <span className={cn('font-bold text-slate-900', primaryClassName)}>{fixed}</span>
                {showLabels && (
                    <span className={cn('text-[10px] uppercase tracking-widest font-bold text-slate-400', fixedLabelClassName)}>
                        {fixedLabel}
                    </span>
                )}
            </span>
        );
    }

    if (layout === 'showcase') {
        // Dark-card variant: converted price is the big number, EUR is the small anchor above it
        const convertedLabel = currency === 'BRL'
            ? (isEn ? 'approx. in BRL · varies daily' : 'aprox. em R$ · varia diariamente')
            : (isEn ? 'approx. in USD · varies daily' : 'aprox. em USD · varia diariamente');
        const eurLabel = isEn ? 'Fixed price (EUR)' : 'Preço fixo (EUR)';
        return (
            <span className={cn('inline-flex flex-col gap-0.5', className)}>
                <span className="inline-flex items-center gap-1.5">
                    <span className={cn('text-sm font-bold text-white/50', primaryClassName)}>{fixed}</span>
                    <span className={cn('text-[9px] uppercase tracking-widest font-bold text-white/30', fixedLabelClassName)}>
                        {eurLabel}
                    </span>
                </span>
                <span className={cn('font-black text-white leading-none', secondaryClassName)}>
                    {variable}
                </span>
                {showLabels && (
                    <span className={cn('text-[9px] uppercase tracking-widest font-bold text-amber-400/70', variableLabelClassName)}>
                        {convertedLabel}
                    </span>
                )}
            </span>
        );
    }

    if (layout === 'compact') {
        return (
            <span className={cn('inline-flex flex-col leading-tight', className)}>
                <span className={cn('font-bold text-slate-900', primaryClassName)}>{fixed}</span>
                <span className={cn('text-[10px] font-semibold text-slate-500', secondaryClassName)}>
                    ≈ {variable} <span className="uppercase tracking-wider">({isEn ? 'variable' : 'variável'})</span>
                </span>
            </span>
        );
    }

    if (layout === 'inline') {
        return (
            <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
                <span className="inline-flex flex-col leading-tight">
                    <span className={cn('font-bold text-slate-900', primaryClassName)}>{fixed}</span>
                    {showLabels && (
                        <span className={cn('text-[10px] uppercase tracking-widest font-bold text-emerald-600', fixedLabelClassName)}>
                            {fixedLabel}
                        </span>
                    )}
                </span>
                <span className="inline-flex flex-col leading-tight">
                    <span className={cn('font-semibold text-slate-600', secondaryClassName)}>≈ {variable}</span>
                    {showLabels && (
                        <span className={cn('text-[10px] uppercase tracking-widest font-bold text-amber-600', variableLabelClassName)}>
                            {variableLabel}
                        </span>
                    )}
                </span>
            </span>
        );
    }

    // stacked — side-by-side: EUR anchor left, secondary currency right
    const shortVariableLabel = isEn
        ? `${currency} · today's rate`
        : `${currency} · câmbio do dia`;

    return (
        <span className={cn('inline-flex items-end gap-4 flex-wrap', className)}>
            <span className="inline-flex flex-col leading-none">
                <span className={cn('font-black text-slate-900 leading-none', primaryClassName)}>{fixed}</span>
                {showLabels && (
                    <span className={cn('text-[9px] uppercase tracking-widest font-bold text-emerald-600 mt-1.5', fixedLabelClassName)}>
                        {fixedLabel}
                    </span>
                )}
            </span>
            <span className="inline-flex flex-col leading-none pb-0.5">
                <span className={cn('font-bold text-slate-400 leading-none', secondaryClassName)}>≈ {variable}</span>
                {showLabels && (
                    <span className={cn('text-[9px] uppercase tracking-widest font-bold text-amber-500 mt-1.5', variableLabelClassName)}>
                        {shortVariableLabel}
                    </span>
                )}
            </span>
        </span>
    );
}

export default PilgrimagePrice;
