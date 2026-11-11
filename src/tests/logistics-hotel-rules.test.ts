import { describe, expect, it } from 'vitest';
import {
    hotelAlerts, lineTotal, linesSummary, scheduleOf, splitInstallments, uncoveredNights,
    type HotelInstallment, type HotelLine, type StayForAlerts,
} from '../lib/logistics/hotel-rules';

const line = (over: Partial<HotelLine>): HotelLine => ({
    id: Math.random().toString(36), kind: 'room', label: '', qty: 0, nights: 2, unitPrice: 0, payOnSite: false, notes: null, ...over,
});

// A proforma do La Meridiana (8 → 10 abr 2027), com a taxa turística por transferência.
const meridiana: HotelLine[] = [
    line({ label: 'Twin HB', qty: 24, unitPrice: 138 }),
    line({ label: 'Double HB', qty: 11, unitPrice: 138 }),
    line({ label: 'Single HB até 3', qty: 3, unitPrice: 99 }),
    line({ label: 'Single HB 4 a 6', qty: 3, unitPrice: 114 }),
    line({ label: 'Single HB 7+', qty: 6, unitPrice: 138 }),
    line({ kind: 'discount', label: 'Free pax in double', qty: 3, unitPrice: 69 }),
    line({ kind: 'supplement', label: 'Água obrigatória', qty: 82, unitPrice: 2 }),
    line({ kind: 'supplement', label: '¼ de vinho', qty: 82, unitPrice: 3 }),
    line({ kind: 'tax', label: 'City tax', qty: 82, unitPrice: 3 }),
];

const schedule: HotelInstallment[] = [
    { id: 'a', label: '1.º sinal', dueDate: '2026-10-28', amount: 3900, notes: null },
    { id: 'b', label: '2.º sinal', dueDate: '2027-03-09', amount: 6500, notes: null },
    { id: 'c', label: 'Saldo', dueDate: '2027-04-01', amount: 3092, notes: null },
];

describe('linhas da proforma', () => {
    it('dá o total da proforma, com a taxa turística incluída', () => {
        expect(linesSummary(meridiana)).toEqual({ transfer: 13492, onSite: 0, total: 13492 });
    });

    it('um desconto conta a menos mesmo escrito com preço positivo', () => {
        expect(lineTotal({ kind: 'discount', qty: 3, nights: 2, unitPrice: 69 })).toBe(-414);
        expect(lineTotal({ kind: 'discount', qty: 3, nights: 2, unitPrice: -69 })).toBe(-414);
    });

    it('separa o que se paga no hotel', () => {
        const onSite = meridiana.map(l => (l.kind === 'tax' ? { ...l, payOnSite: true } : l));
        expect(linesSummary(onSite)).toEqual({ transfer: 13000, onSite: 492, total: 13492 });
    });
});

describe('prestações', () => {
    it('o pago do banco enche as prestações por ordem de data', () => {
        const plan = scheduleOf(schedule, 3900, '2026-11-11');
        expect(plan.items.map(i => i.state)).toEqual(['paid', 'upcoming', 'upcoming']);
        expect(plan.next?.label).toBe('2.º sinal');
        expect(plan.sum).toBe(13492);
    });

    it('avisa a partir de 7 dias antes e depois em atraso', () => {
        expect(scheduleOf(schedule, 3900, '2027-03-02').items[1].state).toBe('due_soon');
        expect(scheduleOf(schedule, 3900, '2027-03-01').items[1].state).toBe('upcoming');
        expect(scheduleOf(schedule, 3900, '2027-03-10').items[1].state).toBe('overdue');
        expect(scheduleOf(schedule, 0, '2026-11-11').items[0].state).toBe('overdue');
    });

    it('um pagamento a meio fica parcial', () => {
        const plan = scheduleOf(schedule, 5000, '2026-11-11');
        expect(plan.items[1]).toMatchObject({ state: 'partial', paidPart: 1100, left: 5400 });
    });

    it('divide 30/50/20 sem perder cêntimos', () => {
        expect(splitInstallments(13492)).toEqual([4047.6, 6746, 2698.4]);
        expect(splitInstallments(100.01).reduce((a, b) => a + b, 0)).toBeCloseTo(100.01, 2);
    });
});

const stay = (over: Partial<StayForAlerts>): StayForAlerts => ({
    id: 'meridiana', hotel: 'La Meridiana', checkIn: '2027-04-08', checkOut: '2027-04-10', status: 'confirmed',
    paid: 3900, transferTotal: 13492, linesTransfer: 13492, installments: schedule,
    agreement: { total: 13492, hasProforma: true, hasFinalInvoice: false },
    optionUntil: null, roomingListDue: null, legacyDueDate: null, ...over,
});

describe('avisos', () => {
    const trip = { start: '2027-04-08', end: '2027-04-10' };

    it('com o 1.º sinal pago e o 2.º longe, não há avisos', () => {
        expect(hotelAlerts([stay({})], trip, '2026-11-11')).toEqual([]);
    });

    it('avisa 7 dias antes do 2.º sinal', () => {
        const [alert] = hotelAlerts([stay({})], trip, '2027-03-04');
        expect(alert).toMatchObject({ kind: 'due_soon', level: 'waiting', stayId: 'meridiana' });
        expect(alert.title).toContain('2.º sinal');
    });

    it('sem nada pago, o 1.º sinal aparece em atraso primeiro', () => {
        const alerts = hotelAlerts([stay({ paid: 0 })], trip, '2026-11-11');
        expect(alerts[0]).toMatchObject({ kind: 'overdue', level: 'alert' });
    });

    it('apanha linhas e prestações que não batem com a proforma', () => {
        const kinds = hotelAlerts([stay({ linesTransfer: 13000, installments: schedule.slice(0, 2) })], trip, '2026-11-11').map(a => a.kind);
        expect(kinds).toContain('lines_mismatch');
        expect(kinds).toContain('schedule_mismatch');
    });

    it('pede a fatura final quando está tudo pago', () => {
        const kinds = hotelAlerts([stay({ paid: 13492 })], trip, '2027-04-02').map(a => a.kind);
        expect(kinds).toEqual(['no_final_invoice']);
    });

    it('pede o plano de pagamentos a um acordo sem prestações', () => {
        expect(hotelAlerts([stay({ installments: [] })], trip, '2026-11-11').map(a => a.kind)).toEqual(['no_schedule']);
    });

    it('mostra as noites sem hotel e ignora alternativas', () => {
        expect(uncoveredNights([{ checkIn: '2027-04-05', checkOut: '2027-04-08', status: 'requested' }], '2027-04-05', '2027-04-10'))
            .toEqual(['2027-04-08', '2027-04-09']);
        expect(uncoveredNights([{ checkIn: '2027-04-05', checkOut: '2027-04-10', status: 'alternative' }], '2027-04-05', '2027-04-07'))
            .toEqual(['2027-04-05', '2027-04-06']);
    });
});
