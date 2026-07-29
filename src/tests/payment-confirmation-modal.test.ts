import { describe, expect, it } from 'vitest';

import { resolvePaymentConfirmationInvoiceState } from '../components/booking/PaymentConfirmationModal';

describe('payment confirmation invoice state', () => {
    it('only reports the invoice as sent when email_sent_at exists', () => {
        expect(resolvePaymentConfirmationInvoiceState(null)).toBe('preparing');
        expect(resolvePaymentConfirmationInvoiceState({ status: 'processing' })).toBe('preparing');
        expect(resolvePaymentConfirmationInvoiceState({
            status: 'issued',
            issued_at: '2026-07-29T16:00:00.000Z',
        })).toBe('issued');
        expect(resolvePaymentConfirmationInvoiceState({
            status: 'issued',
            issued_at: '2026-07-29T16:00:00.000Z',
            email_sent_at: '2026-07-29T16:00:03.000Z',
        })).toBe('sent');
    });
});
