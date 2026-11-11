import {
    type HotelStayRow, type LogisticsAccounts, stayCostOf,
} from '../../../../../../lib/logistics-accounts';
import {
    hotelAlerts, scheduleOf, type HotelAlert, type ScheduledInstallment, type StayForAlerts,
} from '../../../../../../lib/logistics/hotel-rules';

export const STATUS_STEPS = [
    { value: 'idea', label: 'A pensar' },
    { value: 'requested', label: 'Pedida' },
    { value: 'prebooked', label: 'Pré-reserva' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'paid', label: 'Paga' },
] as const;

export const statusLabel = (status: string) => STATUS_STEPS.find(step => step.value === status)?.label ?? status;

/** Hoje em yyyy-mm-dd, no fuso do admin. */
export function todayIso(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export type HotelView = {
    stay: HotelStayRow;
    index: number;
    cost: ReturnType<typeof stayCostOf>;
    schedule: ReturnType<typeof scheduleOf>;
    alerts: HotelAlert[];
    /** O alerta mais importante, para o cartão. */
    headline: HotelAlert | null;
    paidShare: number;
};

export type BoardView = {
    hotels: HotelView[];
    alerts: HotelAlert[];
    installments: (ScheduledInstallment & { stayId: string; hotel: string })[];
    totals: { transfer: number; onSite: number; paid: number; left: number; dueSoon: number; overdue: number };
    today: string;
};

export function toStayForAlerts(stay: HotelStayRow, cost: ReturnType<typeof stayCostOf>): StayForAlerts {
    return {
        id: stay.id,
        hotel: stay.hotel,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        status: stay.status,
        paid: stay.paidAmount,
        transferTotal: cost.transferTotal,
        linesTransfer: cost.linesTransfer,
        installments: stay.installments ?? [],
        agreement: stay.agreement
            ? { total: stay.agreement.total, hasProforma: stay.agreement.hasProforma, hasFinalInvoice: stay.agreement.hasFinalInvoice }
            : null,
        optionUntil: stay.optionUntil,
        roomingListDue: stay.roomingListDue,
        legacyDueDate: stay.dueDate,
    };
}

export function buildBoard(accounts: LogisticsAccounts, today = todayIso()): BoardView {
    const ordered = [...accounts.stays].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const hotels = ordered.map((stay, i) => {
        const cost = stayCostOf(stay, accounts.roomMix);
        const schedule = scheduleOf(stay.installments ?? [], stay.paidAmount, today);
        const alerts = hotelAlerts([toStayForAlerts(stay, cost)], { start: null, end: null }, today);
        return {
            stay, index: i + 1, cost, schedule, alerts,
            headline: alerts[0] ?? null,
            paidShare: cost.transferTotal > 0 ? Math.min(1, stay.paidAmount / cost.transferTotal) : 0,
        };
    });

    const alerts = hotelAlerts(
        hotels.map(h => toStayForAlerts(h.stay, h.cost)),
        { start: accounts.pilgrimage.startDate, end: accounts.pilgrimage.endDate },
        today,
    );

    const installments = hotels
        .flatMap(h => h.schedule.items.map(item => ({ ...item, stayId: h.stay.id, hotel: h.stay.hotel })))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const sum = (pick: (h: HotelView) => number) => hotels.reduce((total, h) => total + pick(h), 0);
    return {
        hotels,
        alerts,
        installments,
        totals: {
            transfer: sum(h => h.cost.transferTotal),
            onSite: sum(h => h.cost.onSite),
            paid: sum(h => h.stay.paidAmount),
            left: sum(h => Math.max(0, h.cost.transferTotal - h.stay.paidAmount)),
            dueSoon: installments.filter(i => i.state === 'due_soon').reduce((t, i) => t + i.left, 0),
            overdue: installments.filter(i => i.state === 'overdue').reduce((t, i) => t + i.left, 0),
        },
        today,
    };
}
