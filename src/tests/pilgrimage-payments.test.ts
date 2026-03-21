import { describe, expect, it } from 'vitest';
import {
  isPaymentAwaitingReceiptValidation,
  isReceiptValidationStatus,
} from '../lib/pilgrimage-payments';

describe('pilgrimage payment validation state', () => {
  it('treats verifying statuses as awaiting validation', () => {
    expect(isReceiptValidationStatus('verifying')).toBe(true);
    expect(isReceiptValidationStatus('pending_verification')).toBe(true);
    expect(isReceiptValidationStatus('pending')).toBe(false);
  });

  it('only flags payments with an uploaded receipt for admin validation', () => {
    expect(
      isPaymentAwaitingReceiptValidation({
        method: 'bank_transfer',
        status: 'verifying',
        receipt_url: 'receipts/user/booking/proof.pdf',
      })
    ).toBe(true);

    expect(
      isPaymentAwaitingReceiptValidation({
        method: 'bank_transfer',
        status: 'pending',
        receipt_url: null,
      })
    ).toBe(false);
  });
});
