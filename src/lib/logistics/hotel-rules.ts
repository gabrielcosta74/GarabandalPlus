/**
 * Regras dos hotéis da logística: conta da proforma, prestações e avisos.
 *
 * Puro (sem base de dados) para ser testado e usado no cliente e no servidor.
 * O pago vem sempre de fora (banco, pelo acordo da Contabilidade); aqui só se
 * decide como esse pago enche as prestações e o que merece um aviso.
 */

export const DUE_SOON_DAYS = 7;

export type HotelLineKind = 'room' | 'supplement' | 'discount' | 'tax' | 'other';

export const LINE_KIND_LABEL: Record<HotelLineKind, string> = {
    room: 'Quarto',
    supplement: 'Suplemento',
    discount: 'Desconto',
    tax: 'Taxa',
    other: 'Outro',
};

export type HotelLine = {
    id: string;
    kind: HotelLineKind;
    label: string;
    qty: number;
    nights: number;
    unitPrice: number;
    /** Pago no hotel à chegada; fica fora do acordo e das prestações. */
    payOnSite: boolean;
    notes: string | null;
};

export type HotelInstallment = {
    id: string;
    label: string;
    dueDate: string;
    amount: number;
    notes: string | null;
};

const cents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

/** Total de uma linha. Um desconto conta sempre a menos, escreva-se o preço como se escrever. */
export function lineTotal(line: Pick<HotelLine, 'kind' | 'qty' | 'nights' | 'unitPrice'>): number {
    const value = fromCents(cents(line.qty * line.nights * line.unitPrice));
    return line.kind === 'discount' ? -Math.abs(value) : value;
}

export function linesSummary(lines: HotelLine[]) {
    let transfer = 0;
    let onSite = 0;
    for (const line of lines) {
        const value = cents(lineTotal(line));
        if (line.payOnSite) onSite += value;
        else transfer += value;
    }
    return { transfer: fromCents(transfer), onSite: fromCents(onSite), total: fromCents(transfer + onSite) };
}

/** Dias de `today` até `iso` (negativo = já passou). Datas sem hora, em UTC. */
export function daysUntil(iso: string, today: string): number {
    const a = Date.parse(`${today}T00:00:00Z`);
    const b = Date.parse(`${iso}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
}

export type InstallmentState = 'paid' | 'partial' | 'overdue' | 'due_soon' | 'upcoming';

export type ScheduledInstallment = HotelInstallment & {
    /** Parte já paga, enchida por ordem de data com o que o banco pagou. */
    paidPart: number;
    left: number;
    state: InstallmentState;
    daysLeft: number;
};

/**
 * Estado de cada prestação. O pago total enche as prestações por ordem de
 * data: 3 900 € pagos cobrem o 1.º sinal de 3 900 €; o 2.º fica por pagar.
 */
export function scheduleOf(installments: HotelInstallment[], paid: number, today: string) {
    const ordered = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    let pool = cents(Math.max(0, paid));
    const items: ScheduledInstallment[] = ordered.map(item => {
        const amount = cents(item.amount);
        const take = Math.min(pool, amount);
        pool -= take;
        const left = amount - take;
        const daysLeft = daysUntil(item.dueDate, today);
        const state: InstallmentState = left <= 0 ? 'paid'
            : daysLeft < 0 ? 'overdue'
                : daysLeft <= DUE_SOON_DAYS ? 'due_soon'
                    : take > 0 ? 'partial' : 'upcoming';
        return { ...item, paidPart: fromCents(take), left: fromCents(left), state, daysLeft };
    });
    const sum = fromCents(ordered.reduce((total, item) => total + cents(item.amount), 0));
    return {
        items,
        sum,
        next: items.find(item => item.left > 0) ?? null,
        overdue: items.filter(item => item.state === 'overdue'),
        dueSoon: items.filter(item => item.state === 'due_soon'),
    };
}

/** Divide um total em prestações (por defeito 30/50/20), com o resto dos cêntimos na última. */
export function splitInstallments(total: number, shares: number[] = [30, 50, 20]): number[] {
    const whole = cents(total);
    const parts = shares.map(share => Math.floor((whole * share) / 100));
    parts[parts.length - 1] += whole - parts.reduce((a, b) => a + b, 0);
    return parts.map(fromCents);
}

export type AlertLevel = 'alert' | 'waiting' | 'neutral';

export type HotelAlert = {
    stayId: string | null;
    level: AlertLevel;
    kind: 'overdue' | 'due_soon' | 'schedule_mismatch' | 'lines_mismatch' | 'no_proforma'
        | 'no_final_invoice' | 'option_expiring' | 'rooming_list' | 'uncovered_night' | 'no_schedule';
    title: string;
    detail: string;
    /** Para ordenar: a data que importa, se houver. */
    date: string | null;
};

export type StayForAlerts = {
    id: string;
    hotel: string;
    checkIn: string;
    checkOut: string;
    status: string;
    paid: number;
    /** O que se transfere ao hotel: acordo, ou linhas, ou estimativa. */
    transferTotal: number;
    linesTransfer: number | null;
    installments: HotelInstallment[];
    agreement: { total: number; hasProforma: boolean; hasFinalInvoice: boolean } | null;
    optionUntil: string | null;
    roomingListDue: string | null;
    /** Prazo antigo, de quando só havia uma data. Usado se não houver prestações. */
    legacyDueDate: string | null;
};

const eur = (value: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);

const when = (days: number) =>
    days === 0 ? 'hoje' : days === 1 ? 'amanhã' : days < 0 ? `há ${-days} ${-days === 1 ? 'dia' : 'dias'}` : `em ${days} dias`;

export function nightsOf(checkIn: string, checkOut: string): string[] {
    const out: string[] = [];
    const start = Date.parse(`${checkIn}T00:00:00Z`);
    const end = Date.parse(`${checkOut}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) return out;
    // Uma viagem não passa de um ano; um intervalo maior é uma data mal escrita.
    for (let t = start; t < end && out.length < 366; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
    return out;
}

/** Noites da viagem sem hotel. `end` é o dia de regresso (sem dormida). */
export function uncoveredNights(stays: Pick<StayForAlerts, 'checkIn' | 'checkOut' | 'status'>[], start: string | null, end: string | null): string[] {
    if (!start || !end) return [];
    const covered = new Set(stays.filter(stay => stay.status !== 'alternative').flatMap(stay => nightsOf(stay.checkIn, stay.checkOut)));
    return nightsOf(start, end).filter(night => !covered.has(night));
}

/**
 * Avisos dos hotéis: só o que pede uma ação ao admin, do mais urgente para o
 * menos. Prazos de pagamento avisam a partir de 7 dias antes.
 */
export function hotelAlerts(
    stays: StayForAlerts[],
    trip: { start: string | null; end: string | null },
    today: string,
): HotelAlert[] {
    const alerts: HotelAlert[] = [];

    for (const stay of stays) {
        if (stay.status === 'alternative') continue;
        const name = stay.hotel || 'Hotel sem nome';

        if (stay.installments.length) {
            const plan = scheduleOf(stay.installments, stay.paid, today);
            for (const item of plan.overdue) alerts.push({
                stayId: stay.id, level: 'alert', kind: 'overdue', date: item.dueDate,
                title: `${name}: ${item.label || 'prestação'} em atraso`,
                detail: `${eur(item.left)} venceu ${when(item.daysLeft)}.`,
            });
            for (const item of plan.dueSoon) alerts.push({
                stayId: stay.id, level: 'waiting', kind: 'due_soon', date: item.dueDate,
                title: `${name}: ${item.label || 'prestação'} vence ${when(item.daysLeft)}`,
                detail: `${eur(item.left)} até ${formatDay(item.dueDate)}.`,
            });
            if (stay.transferTotal > 0 && Math.abs(cents(plan.sum) - cents(stay.transferTotal)) > 100) alerts.push({
                stayId: stay.id, level: 'neutral', kind: 'schedule_mismatch', date: null,
                title: `${name}: prestações não somam o total`,
                detail: `Prestações ${eur(plan.sum)} · total ${eur(stay.transferTotal)}.`,
            });
        } else if (stay.legacyDueDate && stay.transferTotal - stay.paid > 0.5) {
            const days = daysUntil(stay.legacyDueDate, today);
            if (days < 0 || days <= DUE_SOON_DAYS) alerts.push({
                stayId: stay.id, level: days < 0 ? 'alert' : 'waiting', kind: days < 0 ? 'overdue' : 'due_soon', date: stay.legacyDueDate,
                title: `${name}: pagamento ${days < 0 ? 'em atraso' : `vence ${when(days)}`}`,
                detail: `${eur(stay.transferTotal - stay.paid)} até ${formatDay(stay.legacyDueDate)}.`,
            });
        } else if (stay.agreement && stay.transferTotal - stay.paid > 0.5) {
            alerts.push({
                stayId: stay.id, level: 'neutral', kind: 'no_schedule', date: null,
                title: `${name}: falta o plano de pagamentos`,
                detail: 'Escreva as prestações da proforma para receber avisos.',
            });
        }

        if (stay.agreement && stay.linesTransfer !== null && Math.abs(cents(stay.linesTransfer) - cents(stay.agreement.total)) > 100) alerts.push({
            stayId: stay.id, level: 'neutral', kind: 'lines_mismatch', date: null,
            title: `${name}: as linhas não batem com a proforma`,
            detail: `Linhas ${eur(stay.linesTransfer)} · proforma ${eur(stay.agreement.total)}.`,
        });
        if (stay.agreement && !stay.agreement.hasProforma) alerts.push({
            stayId: stay.id, level: 'neutral', kind: 'no_proforma', date: null,
            title: `${name}: falta anexar a proforma`, detail: 'Fica no acordo, na Contabilidade.',
        });
        if (stay.agreement && stay.paid + 0.5 >= stay.agreement.total && !stay.agreement.hasFinalInvoice) alerts.push({
            stayId: stay.id, level: 'neutral', kind: 'no_final_invoice', date: null,
            title: `${name}: pago, falta a fatura final`, detail: 'Peça a fatura ao hotel e junte-a ao acordo.',
        });

        const confirmed = stay.status === 'confirmed' || stay.status === 'paid';
        if (stay.optionUntil && !confirmed) {
            const days = daysUntil(stay.optionUntil, today);
            if (days <= DUE_SOON_DAYS) alerts.push({
                stayId: stay.id, level: days < 0 ? 'alert' : 'waiting', kind: 'option_expiring', date: stay.optionUntil,
                title: `${name}: opção ${days < 0 ? 'expirou' : `expira ${when(days)}`}`,
                detail: 'Confirme a reserva com o hotel.',
            });
        }
        if (stay.roomingListDue) {
            const days = daysUntil(stay.roomingListDue, today);
            if (days >= -1 && days <= DUE_SOON_DAYS) alerts.push({
                stayId: stay.id, level: days < 0 ? 'alert' : 'waiting', kind: 'rooming_list', date: stay.roomingListDue,
                title: `${name}: enviar a rooming list ${when(days)}`,
                detail: `Prazo ${formatDay(stay.roomingListDue)}.`,
            });
        }
    }

    const gaps = uncoveredNights(stays, trip.start, trip.end);
    if (gaps.length) alerts.push({
        stayId: null, level: 'waiting', kind: 'uncovered_night', date: gaps[0],
        title: `${gaps.length} ${gaps.length === 1 ? 'noite sem hotel' : 'noites sem hotel'}`,
        detail: gaps.map(formatDay).join(', '),
    });

    const rank: Record<AlertLevel, number> = { alert: 0, waiting: 1, neutral: 2 };
    return alerts.sort((a, b) => rank[a.level] - rank[b.level] || (a.date || '9999').localeCompare(b.date || '9999'));
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDay(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} ${MONTHS[m - 1]}${y !== new Date().getUTCFullYear() ? ` ${y}` : ''}`;
}
