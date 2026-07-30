"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Info } from 'lucide-react';

import { cn } from '../../../lib/utils';
import type { FactptAttentionItem } from './types';
import { formatMoney, TONE_CHIP, type Tone } from './ui';

const SEVERITY: Record<FactptAttentionItem['severity'], { tone: Tone; icon: typeof Clock3 }> = {
    error: { tone: 'rose', icon: AlertTriangle },
    warning: { tone: 'amber', icon: Clock3 },
    info: { tone: 'sky', icon: Info },
};

export default function FactptAttentionPanel({
    items,
    onOpenDocument,
}: {
    items: FactptAttentionItem[];
    onOpenDocument: (documentId: string | null) => void;
}) {
    return (
        <article className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Requer atenção</h2>
                {items.length > 0 && (
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-rose-500 px-2 text-[13px] font-bold text-white tabular-nums">
                        {items.length}
                    </span>
                )}
            </header>

            {items.length === 0 ? (
                <div className="flex items-center gap-3 px-5 py-6">
                    <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', TONE_CHIP.emerald)}>
                        <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <strong className="text-[15px] font-semibold text-slate-900">Sem pendências</strong>
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {items.slice(0, 6).map((item) => {
                        const severity = SEVERITY[item.severity];
                        const Icon = severity.icon;
                        const subtitle = [item.customerName, item.description].filter(Boolean).join(' · ');
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenDocument(item.documentId)}
                                    disabled={!item.documentId}
                                    className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors duration-200 hover:bg-slate-50/80 disabled:cursor-default disabled:hover:bg-transparent"
                                >
                                    <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', TONE_CHIP[severity.tone])}>
                                        <Icon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <strong className="block truncate text-[15px] font-semibold text-slate-900">{item.title}</strong>
                                        {subtitle && <small className="mt-0.5 block truncate text-[13px] text-slate-500">{subtitle}</small>}
                                    </span>
                                    {item.amount !== null && (
                                        <span className="flex-shrink-0 text-[15px] font-semibold text-slate-800 tabular-nums">
                                            {formatMoney(item.amount)}
                                        </span>
                                    )}
                                    {item.documentId && (
                                        <ChevronRight
                                            className="h-[18px] w-[18px] flex-shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500"
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </article>
    );
}
