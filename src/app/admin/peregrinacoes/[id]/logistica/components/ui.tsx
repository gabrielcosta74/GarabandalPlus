"use client";

/**
 * Camada de compatibilidade.
 *
 * Os separadores Painel, Cobranças e Contas ainda usam estas peças. Cada uma
 * delega no `kit.tsx` ou no `StatCard` partilhado, para que a cor e a escala
 * tipográfica venham de um sítio só — o `kit` é a fonte da verdade.
 */

import React from 'react';
import { Circle, type LucideIcon } from 'lucide-react';
import StatCard from '../../../../../../components/admin/ui/StatCard';
import { STATUS_LABEL, type LogisticsStatus } from '../../../../../../lib/logistics-accounts';
import { Surface, Pill, ROLE_TONE, roleBadge, roleDot, type Role } from './kit';

export { Surface as Card };

/** Tons legados dos separadores antigos → papéis do kit. */
const LEGACY_ROLE: Record<'neutral' | 'good' | 'warn' | 'bad' | 'info', Role> = {
    neutral: 'neutral',
    good: 'done',
    warn: 'waiting',
    bad: 'alert',
    info: 'neutral',
};

export function StatTile({
    label, value, hint, tone = 'neutral', icon,
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'neutral' | 'good' | 'warn' | 'bad';
    icon?: LucideIcon;
}) {
    return (
        <StatCard
            label={label}
            value={value}
            detail={hint}
            icon={icon ?? Circle}
            tone={ROLE_TONE[LEGACY_ROLE[tone]]}
        />
    );
}

const STATUS_ROLE: Record<LogisticsStatus, Role> = {
    idea: 'neutral',
    requested: 'waiting',
    prebooked: 'progress',
    confirmed: 'done',
    paid: 'done',
};

export function StatusPill({ status }: { status: LogisticsStatus }) {
    return <Pill role={STATUS_ROLE[status]}>{STATUS_LABEL[status]}</Pill>;
}

/** Medidor. Sem eixos — não é um gráfico, é uma barra de progresso. */
export function Meter({
    value, max, color = '#059669', trackClass = 'bg-slate-100',
}: {
    value: number;
    max: number;
    color?: string;
    trackClass?: string;
}) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className={`h-2 w-full overflow-hidden rounded-full ${trackClass}`}>
            <div
                className="h-full rounded-r-[4px] transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
            />
        </div>
    );
}

export function Alert({
    tone, title, children, action,
}: {
    tone: 'warn' | 'bad' | 'info' | 'good';
    title: string;
    children?: React.ReactNode;
    action?: React.ReactNode;
}) {
    const role = LEGACY_ROLE[tone];
    return (
        <div className={`rounded-xl px-4 py-3 ring-1 ring-inset ${roleBadge(role)}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[14px] font-semibold">
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${roleDot(role)}`} />
                        {title}
                    </p>
                    {children && <div className="mt-1 pl-3.5 text-[13.5px] leading-relaxed opacity-90">{children}</div>}
                </div>
                {action}
            </div>
        </div>
    );
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: keyof typeof ALIGN }) {
    return (
        <th className={`whitespace-nowrap px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-slate-400 ${ALIGN[align]}`}>
            {children}
        </th>
    );
}

export function Td({
    children, align = 'left', className = '', colSpan,
}: {
    children: React.ReactNode;
    align?: keyof typeof ALIGN;
    className?: string;
    colSpan?: number;
}) {
    return (
        <td colSpan={colSpan} className={`px-5 py-3.5 text-[14px] text-slate-700 ${ALIGN[align]} ${className}`}>
            {children}
        </td>
    );
}
