'use client';

import { Unlock } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface Props {
    /** Public launch time, epoch ms. */
    target: number;
    isEn?: boolean;
    onExpire?: () => void;
}

/**
 * Fixed, always-floating premium bar pinned to the very top of the screen while
 * the viewer is inside the early-access window. Mobile-first: a small tag line
 * with a large, centered live countdown to the public launch. The detail page
 * reserves matching top padding so nothing is hidden behind it.
 */
export default function EarlyAccessBanner({ target, isEn = false, onExpire }: Props) {
    const t = isEn
        ? { tag: 'Early access unlocked', line: 'Opens in' }
        : { tag: 'Acesso antecipado ativo', line: 'Abre em' };

    return (
        <div
            className="fixed inset-x-0 top-0 z-[120] pt-[env(safe-area-inset-top)]"
            role="status"
        >
            <div className="relative overflow-hidden border-b border-amber-300/25 bg-slate-950/95 backdrop-blur-md shadow-lg shadow-black/20">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/12 blur-3xl" />
                <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-1 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                        <Unlock className="h-3 w-3" strokeWidth={2.4} />
                        <span>{t.tag}</span>
                        <span className="text-white/35">·</span>
                        <span className="text-white/60">{t.line}</span>
                    </div>
                    <CountdownTimer target={target} isEn={isEn} size="md" onComplete={onExpire} />
                </div>
            </div>
        </div>
    );
}
