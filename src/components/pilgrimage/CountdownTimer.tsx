'use client';

import { useEffect, useState } from 'react';

interface Props {
    /** Target time in epoch milliseconds. */
    target: number;
    isEn?: boolean;
    /** Called once when the countdown reaches zero. */
    onComplete?: () => void;
    /** Visual size. 'lg' gate hero, 'md' floating bar, 'sm' inline. */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const getParts = (ms: number) => {
    const clamped = Math.max(0, ms);
    const totalSeconds = Math.floor(clamped / 1000);
    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
};

/**
 * Minimalist, mobile-first countdown. Renders four tiles (days / hours / min /
 * sec) and fires `onComplete` when the target passes.
 */
export default function CountdownTimer({ target, isEn = false, onComplete, size = 'lg', className = '' }: Props) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const remaining = target - now;
    const done = remaining <= 0;

    useEffect(() => {
        if (done) onComplete?.();
    }, [done, onComplete]);

    const { days, hours, minutes, seconds } = getParts(remaining);

    const labels = isEn
        ? { days: 'Days', hours: 'Hrs', minutes: 'Min', seconds: 'Sec' }
        : { days: 'Dias', hours: 'Hrs', minutes: 'Min', seconds: 'Seg' };

    const units: Array<[string, string]> = [
        [pad(days), labels.days],
        [pad(hours), labels.hours],
        [pad(minutes), labels.minutes],
        [pad(seconds), labels.seconds],
    ];

    const tile = size === 'lg'
        ? 'min-w-[3.75rem] sm:min-w-[4.5rem] px-2.5 py-2.5 sm:px-3.5 sm:py-3'
        : size === 'md'
            ? 'min-w-[2.9rem] px-2 py-1.5'
            : 'min-w-[2.6rem] px-1.5 py-1';
    const digit = size === 'lg'
        ? 'text-2xl sm:text-3xl font-black tabular-nums'
        : size === 'md'
            ? 'text-xl font-black tabular-nums'
            : 'text-base font-black tabular-nums';
    const cap = size === 'lg'
        ? 'text-[9px] sm:text-[10px] tracking-[0.22em]'
        : size === 'md'
            ? 'text-[8px] tracking-[0.2em]'
            : 'text-[7px] tracking-[0.18em]';
    const showSeparators = size === 'lg' || size === 'md';

    return (
        <div className={`flex items-stretch ${size === 'lg' ? 'gap-2 sm:gap-3' : size === 'md' ? 'gap-1' : 'gap-1.5'} ${className}`} role="timer" aria-live="off">
            {units.map(([value, label], i) => (
                <div key={label} className="flex items-stretch">
                    <div className={`flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-sm text-white ${tile}`}>
                        <span className={digit}>{value}</span>
                        <span className={`font-bold uppercase text-white/50 ${cap}`}>{label}</span>
                    </div>
                    {showSeparators && i < units.length - 1 && (
                        <span className={`self-center font-black text-white/25 ${size === 'lg' ? 'px-0.5 text-lg sm:px-1' : 'px-0.5 text-sm'}`}>:</span>
                    )}
                </div>
            ))}
        </div>
    );
}
