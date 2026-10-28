import { describe, expect, it } from 'vitest';
import { buildDietaryRows, dietaryAnswerSchema, dietaryCsv, getDietaryInfo } from '../lib/pilgrimage-dietary';

describe('pilgrimage food allergy records', () => {
    it('distinguishes missing information from an explicit no', () => {
        expect(getDietaryInfo({ allergies: '  ', dietary_restrictions: null }).status).toBe('pending');
        for (const answer of ['Não', 'NO', 'Nenhuma', 'Sem alergias alimentares.', 'Não tenho alergias', 'No food allergies', 'Sem restrições alimentares']) {
            expect(getDietaryInfo({ allergies: answer }).status).toBe('none');
        }
    });

    it('preserves separate legacy restrictions while removing mirrored duplicate fields', () => {
        expect(getDietaryInfo({ allergies: ' Frutos secos ', dietary_restrictions: 'frutos secos' }).details).toBe('frutos secos');
        expect(getDietaryInfo({ allergies: 'Não', dietary_restrictions: 'Sem lactose' })).toMatchObject({ status: 'declared', details: 'Sem lactose' });
        expect(getDietaryInfo({ allergies: 'Amendoim', dietary_restrictions: 'Vegetariano' }).details).toBe('Amendoim\nVegetariano');
    });

    it('does not discard uncertain or qualified answers', () => {
        for (const answer of ['Não sei', 'Não posso comer marisco', 'No nuts', 'Não, mas sou vegetariano']) {
            expect(getDietaryInfo({ allergies: answer })).toMatchObject({ status: 'declared', details: answer });
        }
    });

    it('requires a deliberate answer and bounds its size', () => {
        expect(dietaryAnswerSchema().safeParse('   ').success).toBe(false);
        expect(dietaryAnswerSchema().safeParse('x'.repeat(2001)).success).toBe(false);
        expect(dietaryAnswerSchema().parse('  Sem lactose  ')).toBe('Sem lactose');
    });

    it('organises each participant by name and excludes cancelled bookings', () => {
        const rows = buildDietaryRows([
            { id: 'a', status: 'confirmed', pilgrims: [{ id: '1', full_name: 'Zélia', allergies: 'Lactose' }, { id: '2', full_name: 'Ana', allergies: null }] },
            { id: 'b', status: 'cancelled', pilgrims: [{ id: '3', full_name: 'Bruno', allergies: 'Ovos' }] },
            { id: 'c', status: 'pending', pilgrims: [{ id: '4', full_name: 'Carlos', allergies: 'Não' }] },
        ]);
        expect(rows.map(row => [row.full_name, row.status, row.booking_id])).toEqual([
            ['Ana', 'pending', 'a'], ['Carlos', 'none', 'c'], ['Zélia', 'declared', 'a'],
        ]);
    });

    it('exports accented, quoted, multiline text safely for spreadsheets', () => {
        const csv = dietaryCsv([{ id: '1', booking_id: 'a', full_name: '=HYPERLINK("evil")', status: 'declared', details: 'Ovos; leite\nEvitar "vestígios"' }]);
        expect(csv.startsWith('\uFEFF')).toBe(true);
        expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
        expect(csv).toContain('"Ovos; leite\nEvitar ""vestígios"""');
        expect(csv).toContain('\r\n');
    });
});
