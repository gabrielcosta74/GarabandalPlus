import type { LucideIcon } from 'lucide-react';

import { cn } from '../../../lib/utils';
import { TONE_CHIP, type Tone } from './tones';

/** Cartão de indicador do painel admin (faturação, transações, …). */
export default function StatCard({
    label,
    value,
    detail,
    icon: Icon,
    tone = 'slate',
    onClick,
    active = false,
    loading = false,
}: {
    label: string;
    value: string;
    detail?: string;
    icon: LucideIcon;
    tone?: Tone;
    /** Quando definido, o cartão funciona como filtro. */
    onClick?: () => void;
    active?: boolean;
    loading?: boolean;
}) {
    const interactive = Boolean(onClick);
    const Wrapper = (interactive ? 'button' : 'article') as 'button';

    return (
        <Wrapper
            {...(interactive ? { type: 'button', onClick, 'aria-pressed': active } : {})}
            className={cn(
                'flex flex-col rounded-2xl border bg-white p-5 text-left transition-all duration-300 ease-out',
                active
                    ? 'border-slate-300 shadow-[0_10px_28px_rgba(15,23,42,0.07)]'
                    : 'border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                interactive && 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] active:translate-y-0'
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <span className="text-[13.5px] font-semibold text-slate-500">{label}</span>
                <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', TONE_CHIP[tone])}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                </span>
            </div>
            {loading ? (
                <>
                    <div className="mt-3 h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
                    <div className="mt-2 h-4 w-20 animate-pulse rounded bg-slate-50" />
                </>
            ) : (
                <>
                    <strong className="mt-3 block truncate text-[30px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
                        {value}
                    </strong>
                    {detail && <span className="mt-2 text-[13px] leading-snug text-slate-500">{detail}</span>}
                </>
            )}
        </Wrapper>
    );
}
