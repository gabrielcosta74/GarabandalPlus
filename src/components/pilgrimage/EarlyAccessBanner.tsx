'use client';

import { useEffect, useState } from 'react';
import { Unlock } from 'lucide-react';

interface Props {
    /** Public launch time, epoch ms. */
    target: number;
    isEn?: boolean;
    onExpire?: () => void;
}

// Always hours:minutes:seconds (days rolled into hours).
const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/**
 * Slim, always-floating early-access bar pinned to the top of the screen. A
 * single compact row (lock + label + inline countdown) that stays out of the
 * way — mobile-first, minimal height.
 */
export default function EarlyAccessBanner({ target, isEn = false, onExpire }: Props) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (target - now <= 0) onExpire?.();
    }, [target, now, onExpire]);

    const t = isEn
        ? { tag: 'Early access', opens: 'Public in' }
        : { tag: 'Acesso antecipado', opens: 'Abre em' };

    return (
        <div className="fixed inset-x-0 top-0 z-[120] pt-[env(safe-area-inset-top)]" role="status">
            <div className="relative border-b border-amber-300/25 bg-slate-950/95 backdrop-blur-md">
                <div className="pointer-events-none absolute left-1/2 top-0 h-full w-40 -translate-x-1/2 bg-amber-400/10 blur-2xl" />
                <div className="relative mx-auto flex h-9 max-w-6xl items-center justify-center gap-1.5 px-3 sm:h-10 sm:gap-2">
                    <Unlock className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2.4} />
                    {/* Labels: desktop only. Mobile shows just the lock + countdown. */}
                    <span className="hidden items-center gap-1.5 sm:flex">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">{t.tag}</span>
                        <span className="text-white/25">·</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{t.opens}</span>
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-amber-200 sm:text-xs">{fmt(target - now)}</span>
                </div>
            </div>
        </div>
    );
}
