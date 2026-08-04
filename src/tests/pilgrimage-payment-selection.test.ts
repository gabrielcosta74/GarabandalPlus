import { describe, expect, it } from 'vitest';
import {
  buildInstallmentAmountChoices,
  getInstallmentPaymentState,
  resolveOutstandingInstallment,
} from '../lib/pilgrimage-payment-selection';

describe('pilgrimage payment selection', () => {
  const cristinaPlan = [
    208.33,
    208.33,
    208.33,
    208.33,
    208.33,
    208.35,
  ].map((amount, index) => ({
    date: `2026-${String(index + 4).padStart(2, '0')}-10`,
    amount,
  }));

  it('moves past a settled installment without floating-point drift', () => {
    const outstanding = resolveOutstandingInstallment({
      paidAmount: 1333.32,
      depositValue: 500,
      paymentPlan: cristinaPlan,
    });

    expect(outstanding).toEqual({
      index: 4,
      amountDue: 208.33,
      remainingAmounts: [208.33, 208.35],
    });
  });

  it('marks the fourth installment as paid and the fifth as pending', () => {
    const common = {
      paidAmount: 1333.32,
      depositValue: 500,
      paymentPlan: cristinaPlan,
    };

    expect(getInstallmentPaymentState({ ...common, index: 3 })).toBe('paid');
    expect(getInstallmentPaymentState({ ...common, index: 4 })).toBe('pending');
  });

  it('keeps the exact value of a partially paid installment', () => {
    const outstanding = resolveOutstandingInstallment({
      paidAmount: 600,
      depositValue: 500,
      paymentPlan: cristinaPlan,
    });

    expect(outstanding).toMatchObject({
      index: 0,
      amountDue: 108.33,
    });
  });

  it('sums the real remaining installments for quick choices', () => {
    expect(buildInstallmentAmountChoices({
      remainingAmounts: [208.33, 208.35],
      maxAmount: 416.68,
    })).toEqual([
      { count: 1, amount: 208.33 },
      { count: 2, amount: 416.68 },
    ]);
  });

  it('keeps an all-balance choice when the plan does not cover the full balance', () => {
    expect(buildInstallmentAmountChoices({
      remainingAmounts: [200, 200],
      maxAmount: 450,
    })).toEqual([
      { count: 1, amount: 200 },
      { count: 2, amount: 400 },
      { count: null, amount: 450 },
    ]);
  });
});
