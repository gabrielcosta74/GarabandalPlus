import {
    AlertTriangle,
    CheckCircle2,
    CircleAlert,
    Clock3,
    Heart,
    IdCard,
    MailWarning,
    Plane,
    RefreshCw,
    ShoppingBag,
    type LucideIcon,
} from 'lucide-react';

import type { FactptSourceType, FactptStatus } from './types';
import type { Tone } from '../ui/tones';

export { TONE_BADGE, TONE_CHIP, TONE_DOT, type Tone } from '../ui/tones';

export const STATUS_META: Record<FactptStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
    awaiting_approval: { label: 'Por aprovar', tone: 'amber', icon: Clock3 },
    pending: { label: 'Na fila', tone: 'slate', icon: Clock3 },
    needs_data: { label: 'Requer dados', tone: 'amber', icon: CircleAlert },
    processing: { label: 'A processar', tone: 'sky', icon: RefreshCw },
    issued: { label: 'Emitida', tone: 'emerald', icon: CheckCircle2 },
    failed: { label: 'Erro na emissão', tone: 'rose', icon: AlertTriangle },
    email_failed: { label: 'Email por enviar', tone: 'rose', icon: MailWarning },
};

export const SOURCE_META: Record<FactptSourceType, { label: string; icon: LucideIcon }> = {
    pilgrimage: { label: 'Peregrinações', icon: Plane },
    donation: { label: 'Donativos', icon: Heart },
    quota: { label: 'Quotas', icon: IdCard },
    store: { label: 'Loja', icon: ShoppingBag },
};

const currencyFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const integerFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });

export function formatMoney(value: number | null | undefined, currency = 'EUR') {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    if (currency === 'EUR') return currencyFormatter.format(value);
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);
}

export function formatCount(value: number | null | undefined) {
    return integerFormatter.format(value || 0);
}

export function formatDate(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatTime(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(date);
}
