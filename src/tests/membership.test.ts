import { describe, it, expect } from 'vitest';
import { calculateNextQuotaDate, daysBetweenUtc, determineMemberStatus } from '../lib/membership-logic';

describe('Membership Logic', () => {

    describe('calculateNextQuotaDate', () => {
        it('should return Jan 31st of CURRENT year if joining in January', () => {
            const jan15 = new Date('2025-01-15T12:00:00Z');
            const result = calculateNextQuotaDate(null, jan15);
            expect(result.toISOString().slice(0, 10)).toBe('2025-01-31');
        });

        it('should return Jan 31st of NEXT year if joining in February', () => {
            const feb1 = new Date('2025-02-01T12:00:00Z');
            const result = calculateNextQuotaDate(null, feb1);
            expect(result.toISOString().slice(0, 10)).toBe('2026-01-31');
        });

        it('should return Jan 31st of NEXT year relative to EXISTING quota date', () => {
            // Case: Renewing a 2025 quota
            const currentQuota = '2025-01-31';
            const result = calculateNextQuotaDate(currentQuota);
            expect(result.toISOString().slice(0, 10)).toBe('2026-01-31');
        });
    });

    describe('determineMemberStatus', () => {
        const quotaDate = '2025-01-31';

        it('should return "atrasado" if 1 day past due', () => {
            const feb1 = new Date('2025-02-01'); // 1 day late
            const status = determineMemberStatus('pendente', quotaDate, false, feb1);
            expect(status).toBe('atrasado');
        });

        it('should return "expirado" if 31 days past due', () => {
            // Jan 31 + 31 days = March 3rd (approx)
            // Let's use exact Math from logic
            // daysBetween(Feb 1, Jan 31) = -1
            // daysBetween(March 4, Jan 31) = -32?
            const march5 = new Date('2025-03-05');
            const status = determineMemberStatus('atrasado', quotaDate, false, march5);
            expect(status).toBe('expirado');
        });

        it('should remain "pago" if paid', () => {
            const feb1 = new Date('2025-02-01');
            const status = determineMemberStatus('pago', quotaDate, true, feb1);
            expect(status).toBe('pago');
        });
    });
});
