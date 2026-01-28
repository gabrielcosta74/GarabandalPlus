import { describe, it, expect } from 'vitest';
import { calculateNextQuotaDate, determineMemberStatus } from '../lib/membership-logic';

describe('Membership Logic', () => {

    describe('calculateNextQuotaDate', () => {
        it('should return Jan 31st of NEXT year if paying in January', () => {
            const jan15 = new Date('2025-01-15T12:00:00Z');
            const result = calculateNextQuotaDate(jan15);
            expect(result.toISOString().slice(0, 10)).toBe('2026-01-31');
        });

        it('should return Jan 31st of NEXT year if paying in December', () => {
            const dec10 = new Date('2025-12-10T12:00:00Z');
            const result = calculateNextQuotaDate(dec10);
            expect(result.toISOString().slice(0, 10)).toBe('2026-01-31');
        });
    });

    describe('determineMemberStatus', () => {
        const quotaDate = '2025-01-31';

        it('should return "expirado" if 1 day past due', () => {
            const feb1 = new Date('2025-02-01'); // 1 day late
            const status = determineMemberStatus('pendente', quotaDate, false, feb1);
            expect(status).toBe('expirado');
        });

        it('should remain "pago" if paid', () => {
            const feb1 = new Date('2025-02-01');
            const status = determineMemberStatus('pago', quotaDate, true, feb1);
            expect(status).toBe('pago');
        });
    });
});
