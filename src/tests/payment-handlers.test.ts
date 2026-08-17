import { describe, expect, it } from 'vitest';

import { resolvePilgrimageConfirmationTimestamp } from '../lib/payment-handlers';

describe('pilgrimage payment confirmation', () => {
  it('preserves the first confirmation time on repeated paid callbacks', () => {
    expect(resolvePilgrimageConfirmationTimestamp({
      existingStatus: 'verified',
      existingVerifiedAt: '2026-07-28T12:13:24.000Z',
      paymentDate: new Date('2026-08-09T20:41:45.000Z'),
    })).toBe('2026-07-28T12:13:24.000Z');
  });

  it('uses the gateway payment date for the first confirmation', () => {
    expect(resolvePilgrimageConfirmationTimestamp({
      existingStatus: 'pending',
      existingVerifiedAt: null,
      paymentDate: new Date('2026-08-17T10:30:00.000Z'),
      now: () => new Date('2026-08-17T10:35:00.000Z'),
    })).toBe('2026-08-17T10:30:00.000Z');
  });
});
