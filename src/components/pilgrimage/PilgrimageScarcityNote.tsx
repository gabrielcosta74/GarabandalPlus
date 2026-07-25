import { Flame } from 'lucide-react';

interface Props {
    remainingSpots: number;
    isEn: boolean;
    isWaitlist?: boolean;
    isClosed?: boolean;
    /** Below or equal to this, show the stronger "last spots" message. */
    criticalThreshold?: number;
    className?: string;
}

/**
 * Honest scarcity nudge for the booking card. Never reveals the exact number of
 * remaining spots — it only escalates the tone when availability is genuinely
 * low, so the urgency stays truthful.
 */
export default function PilgrimageScarcityNote({
    remainingSpots,
    isEn,
    isWaitlist,
    isClosed,
    criticalThreshold = 6,
    className = '',
}: Props) {
    // Closed / waitlist states are already communicated by the CTA + status badge.
    if (isClosed || isWaitlist) return null;

    const finite = Number.isFinite(remainingSpots);
    const critical = finite && remainingSpots > 0 && remainingSpots <= criticalThreshold;

    // Only nudge when availability is genuinely low — the generic "spots run out
    // fast" note was removed at the operator's request.
    if (!critical) return null;

    const title = isEn ? 'Last spots' : 'Últimos lugares';
    const subtitle = isEn ? 'Almost fully booked — secure your place now.' : 'Quase esgotado — garanta já o seu lugar.';

    return (
        <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${critical
                ? 'border-red-200 bg-gradient-to-r from-red-50 to-amber-50'
                : 'border-amber-200 bg-amber-50/70'
                } ${className}`}
            role="status"
        >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                <Flame className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    {critical && (
                        <span className="relative flex h-2 w-2" aria-hidden>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                    )}
                    <p className={`text-sm font-black ${critical ? 'text-red-700' : 'text-amber-800'}`}>{title}</p>
                </div>
                <p className="text-xs font-medium text-slate-500">{subtitle}</p>
            </div>
        </div>
    );
}
