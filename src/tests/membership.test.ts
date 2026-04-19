import { describe, it, expect } from 'vitest';
import { calculateNextQuotaDate, determineMemberStatus } from '../lib/membership-logic';
import { getNextMemberNumber } from '../lib/membership-db';

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

    describe('getNextMemberNumber', () => {
        it('ignores pending non-member placeholders when calculating the next member number', async () => {
            const rows = [
                { numero_socio: '139', is_membro: true, estado_quota: 'pago' },
                { numero_socio: '140', is_membro: false, estado_quota: 'pendente' },
                { numero_socio: '141', is_membro: false, estado_quota: 'pendente' },
                { numero_socio: '142', is_membro: false, estado_quota: 'pendente' },
            ];

            const supabase = {
                from: () => ({
                    select: () => ({
                        not: () => ({
                            order: () => ({
                                range: async (from: number, to: number) => ({
                                    data: rows.slice(from, to + 1),
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                }),
            };

            await expect(getNextMemberNumber(supabase as any)).resolves.toBe(140);
        });

        it('keeps existing official numbers reserved even if access is no longer active', async () => {
            const rows = [
                { numero_socio: '139', is_membro: true, estado_quota: 'pago' },
                { numero_socio: '140', is_membro: false, estado_quota: 'revogado' },
            ];

            const supabase = {
                from: () => ({
                    select: () => ({
                        not: () => ({
                            order: () => ({
                                range: async (from: number, to: number) => ({
                                    data: rows.slice(from, to + 1),
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                }),
            };

            await expect(getNextMemberNumber(supabase as any)).resolves.toBe(141);
        });
    });
});
