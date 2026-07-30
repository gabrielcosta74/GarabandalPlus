"use client";

import { RefreshCw } from 'lucide-react';

import { cn } from '../../../lib/utils';
import type { FactptEnvironment } from './types';

export default function FactptToolbar({
    environment,
    onEnvironmentChange,
    onRefresh,
    refreshing,
    updatedAt,
}: {
    environment: FactptEnvironment;
    onEnvironmentChange: (environment: FactptEnvironment) => void;
    onRefresh: () => void;
    refreshing: boolean;
    updatedAt: string | null;
}) {
    return (
        <section className="flex flex-wrap items-center gap-3" aria-label="Contexto da faturação">
            <div
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                role="group"
                aria-label="Ambiente FACT.pt"
            >
                {(['production', 'sandbox'] as FactptEnvironment[]).map((value) => {
                    const isActive = environment === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onEnvironmentChange(value)}
                            aria-pressed={isActive}
                            className={cn(
                                'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[14px] font-semibold transition-all duration-200',
                                isActive
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            )}
                        >
                            {value === 'production' && (
                                <span
                                    className={cn(
                                        'h-2 w-2 rounded-full',
                                        isActive ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-emerald-500 ring-2 ring-emerald-100'
                                    )}
                                />
                            )}
                            {value === 'production' ? 'Produção' : 'Sandbox'}
                        </button>
                    );
                })}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-3">
                {updatedAt && (
                    <span className="hidden text-[13px] text-slate-400 sm:inline">Atualizado às {updatedAt}</span>
                )}

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 text-[14px] font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} strokeWidth={2.25} aria-hidden="true" />
                    Atualizar
                </button>
            </div>
        </section>
    );
}
