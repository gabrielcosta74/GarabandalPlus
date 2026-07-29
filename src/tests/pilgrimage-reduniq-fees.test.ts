import { describe, expect, it } from 'vitest';
import {
  REDUNIQ_PILGRIMAGE_FEE_RATE,
  buildPilgrimageReduniqFeeNote,
  calculatePilgrimageReduniqCharge,
  resolvePilgrimagePaymentKind,
} from '../lib/pilgrimage-reduniq-fees';

describe('pilgrimage reduniq fee calculation', () => {
  it('applies the 1.9% fee and rounds correctly', () => {
    const result = calculatePilgrimageReduniqCharge(625);

    expect(result.feeRate).toBe(REDUNIQ_PILGRIMAGE_FEE_RATE);
    expect(result.baseAmount).toBe(625);
    expect(result.feeAmount).toBe(11.88);
    expect(result.chargedAmount).toBe(636.88);
  });

  it('builds a readable note for the pending payment record', () => {
    const note = buildPilgrimageReduniqFeeNote(100);

    expect(note).toContain('Pagamento via Reduniq');
    expect(note).toContain('Valor base: 100.00€');
    expect(note).toContain('Taxa Reduniq: 1.90€');
    expect(note).toContain('Total cobrado: 101.90€');
  });

  it('charges exactly ten cents when the rounded fee is zero', () => {
    expect(calculatePilgrimageReduniqCharge(0.10)).toMatchObject({
      baseAmount: 0.10,
      feeAmount: 0,
      chargedAmount: 0.10,
    });
  });

  it('classifies payments after the deposit as installments', () => {
    expect(resolvePilgrimagePaymentKind('deposit', 1.50, 0.50)).toBe('installment');
    expect(resolvePilgrimagePaymentKind('deposit', 0, 0.50)).toBe('deposit');
    expect(resolvePilgrimagePaymentKind('full', 0.50, 0.50)).toBe('balance');
  });
});
