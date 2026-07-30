"use client";

import { ArrowRight, CheckCircle2, Scale, TriangleAlert } from 'lucide-react';

import { cn } from '../../../lib/utils';
import type { FactptOverview } from './types';
import { formatCount, formatMoney, TONE_CHIP } from './ui';

/** Conciliação Reduniq ↔ FACT.pt: dinheiro confirmado vs. faturado. */
export default function FactptReconciliationPanel({
    reconciliation,
}: {
    reconciliation: FactptOverview['reconciliation'];
}) {
    const gaps = reconciliation.unmatchedPayments + reconciliation.mismatchedPayments + reconciliation.unissuedDocuments;
    const balanced = Math.abs(reconciliation.difference) < 0.01 && gaps === 0;
    const other = reconciliation.otherMethods;
    const invoicedShare = reconciliation.reduniqConfirmedAmount > 0
        ? Math.min(100, Math.round((reconciliation.factptIssuedAmount / reconciliation.reduniqConfirmedAmount) * 100))
        : 0;

    return (
        <article className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset', TONE_CHIP.slate)}>
                        <Scale className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Conciliação Reduniq</h2>
                </div>
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset',
                        balanced ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
                    )}
                >
                    {balanced
                        ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                        : <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />}
                    {balanced ? 'Conciliado' : 'A conciliar'}
                </span>
            </header>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
                <div>
                    <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">Recebido</p>
                    <p className="mt-1 text-[22px] font-bold leading-none text-slate-900 tabular-nums">
                        {formatMoney(reconciliation.reduniqConfirmedAmount)}
                    </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden="true" />
                <div>
                    <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">Faturado</p>
                    <p className="mt-1 text-[22px] font-bold leading-none text-slate-900 tabular-nums">
                        {formatMoney(reconciliation.factptIssuedAmount)}
                    </p>
                </div>
                <div className="ml-auto text-right">
                    <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">Diferença</p>
                    <p className={cn(
                        'mt-1 text-[22px] font-bold leading-none tabular-nums',
                        balanced ? 'text-emerald-600' : 'text-amber-600'
                    )}>
                        {formatMoney(reconciliation.difference)}
                    </p>
                </div>
            </div>

            {/* Proporção já faturada do que entrou — leitura imediata do desvio. */}
            <div className="px-5 pb-4">
                <div className="flex items-center justify-between text-[12.5px] font-medium text-slate-500">
                    <span>Faturado do recebido</span>
                    <span className="font-semibold text-slate-700 tabular-nums">{invoicedShare}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', balanced ? 'bg-emerald-500' : 'bg-amber-500')}
                        style={{ width: `${invoicedShare}%` }}
                    />
                </div>
            </div>

            <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-4">
                <Stat label="Pagamentos" value={formatCount(reconciliation.confirmedPayments)} />
                <Stat label="Faturas emitidas" value={formatCount(reconciliation.issuedDocuments)} />
                <Stat label="Sem fatura" value={formatCount(reconciliation.unissuedDocuments + reconciliation.unmatchedPayments)} alert={reconciliation.unissuedDocuments + reconciliation.unmatchedPayments > 0} />
                <Stat label="Valores divergentes" value={formatCount(reconciliation.mismatchedPayments)} alert={reconciliation.mismatchedPayments > 0} />
            </dl>

            {(other.confirmedPayments > 0 || other.factptIssuedAmount > 0) && (
                <p className="border-t border-slate-100 px-5 py-3 text-[13px] text-slate-500">
                    Outros métodos: {formatMoney(other.confirmedAmount)} recebidos · {formatMoney(other.factptIssuedAmount)} faturados
                    {Math.abs(other.difference) >= 0.01 && (
                        <span className="font-semibold text-amber-600"> · {formatMoney(other.difference)} de diferença</span>
                    )}
                </p>
            )}
        </article>
    );
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
    return (
        <div>
            <dt className="text-[12.5px] font-medium text-slate-500">{label}</dt>
            <dd className={cn('mt-0.5 text-[17px] font-bold leading-none tabular-nums', alert ? 'text-amber-600' : 'text-slate-900')}>
                {value}
            </dd>
        </div>
    );
}
