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
