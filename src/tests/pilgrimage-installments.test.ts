import { describe, expect, it } from 'vitest';
import {
    calculateInstallments,
    getConfiguredInstallmentDeadline,
    getMaxInstallments,
    isPaymentPlanWithinDeadline,
} from '../lib/pilgrimage-installments';

describe('pilgrimage installment deadlines', () => {
    const now = new Date(2026, 6, 24, 12);
    const deadline = '2027-04-01';

    it('reads a valid deadline from pricing_config', () => {
        expect(getConfiguredInstallmentDeadline({
            pricing_config: { installment_deadline: deadline },
        })).toBe(deadline);
        expect(getConfiguredInstallmentDeadline({
            pricing_config: { installment_deadline: '2027-02-31' },
        })).toBeNull();
    });

    it('accepts Supabase timestamp values for the pilgrimage start date', () => {
        expect(getMaxInstallments(
            '2027-04-05T00:00:00+00:00',
            null,
            now,
        )).toBe(7);
    });

    it('uses 1 April 2027 as the final date of the maximum plan', () => {
        const maximum = getMaxInstallments('2027-04-05', deadline, now);
        const plan = calculateInstallments(900, '2027-04-05', maximum, deadline, now);

        expect(maximum).toBe(9);
        expect(plan).toHaveLength(9);
        expect(plan.at(-1)?.date.getFullYear()).toBe(2027);
        expect(plan.at(-1)?.date.getMonth()).toBe(3);
        expect(plan.at(-1)?.date.getDate()).toBe(1);
        expect(plan.reduce((total, installment) => total + installment.amount, 0)).toBe(900);
    });

    it('moves the August installment to the 15th without adding an eleventh payment', () => {
        const registrationDate = new Date(2026, 9, 13, 12);
        const maximum = getMaxInstallments('2027-10-11', '2027-08-15', registrationDate);
        const plan = calculateInstallments(1350, '2027-10-11', maximum, '2027-08-15', registrationDate);

        expect(maximum).toBe(10);
        expect(plan).toHaveLength(10);
        expect(plan.at(-1)?.date).toEqual(new Date(2027, 7, 15, 12));
        expect(plan.filter(payment => payment.date.getMonth() === 7)).toHaveLength(1);
    });

    it('rejects a stored plan with a payment after the configured deadline', () => {
        expect(isPaymentPlanWithinDeadline(
            JSON.stringify([{ date: '2027-04-01T12:00:00.000Z', amount: 100 }]),
            deadline,
        )).toBe(true);
        expect(isPaymentPlanWithinDeadline(
            JSON.stringify([{ date: '2027-04-02T12:00:00.000Z', amount: 100 }]),
            deadline,
        )).toBe(false);
    });
});
