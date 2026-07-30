import { cn } from '../../../lib/utils';
import type { FactptStatus } from './types';
import { STATUS_META, TONE_BADGE } from './ui';

export default function FactptStatusBadge({ status, className }: { status: FactptStatus; className?: string }) {
    const meta = STATUS_META[status];
    const Icon = meta.icon;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset',
                TONE_BADGE[meta.tone],
                className
            )}
        >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            {meta.label}
        </span>
    );
}
