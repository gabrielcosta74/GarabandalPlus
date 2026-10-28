import { z } from 'zod';

export const DIETARY_MAX_LENGTH = 2000;

export function dietaryAnswerSchema(isEn = false) {
    return z.string().trim()
        .min(1, isEn ? 'Describe your food allergies or write “No”.' : 'Indica as alergias alimentares ou escreve “Não”.')
        .max(DIETARY_MAX_LENGTH, isEn ? 'Use up to 2000 characters.' : 'Usa até 2000 caracteres.');
}

export type DietaryFields = {
    allergies?: string | null;
    dietary_restrictions?: string | null;
};

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.!]+$/, '');
const NONE_ANSWERS = new Set([
    'nao', 'no', 'nenhuma', 'nenhumas', 'nenhum', 'none', 'nao tenho',
    'nao tenho alergias', 'nao tenho alergias alimentares',
    'nao tem alergias', 'nao tem alergias alimentares',
    'nenhuma alergia', 'nenhuma alergia alimentar',
    'sem alergias', 'sem alergias alimentares', 'sem restricoes', 'sem restricoes alimentares',
    'no allergies', 'no food allergies', 'no dietary restrictions', 'n/a',
]);

/** Keep legacy dietary notes, deduplicate the mirrored fields, and never treat blank as “no allergies”. */
export function getDietaryInfo(person: DietaryFields) {
    const values = [person.allergies, person.dietary_restrictions].map(value => value?.trim() || '').filter(Boolean);
    const details = [...new Map(values.filter(value => !NONE_ANSWERS.has(normalized(value)))
        .map(value => [normalized(value), value])).values()].join('\n');
    const status = details ? 'declared' : values.length ? 'none' : 'pending';
    return { status, details, answer: details || (status === 'none' ? 'Não' : '') } as const;
}

export type DietaryRow = {
    id: string;
    booking_id: string;
    full_name: string;
    status: 'declared' | 'none' | 'pending';
    details: string;
};

export type DietaryBooking = {
    id: string;
    status: string;
    pilgrims: Array<DietaryFields & { id: string; full_name: string }>;
};

export function buildDietaryRows(bookings: DietaryBooking[]): DietaryRow[] {
    return bookings.filter(booking => !['cancelled', 'canceled', 'expired'].includes(booking.status))
        .flatMap(booking => (booking.pilgrims || []).map(person => ({
            id: person.id,
            booking_id: booking.id,
            full_name: person.full_name,
            ...getDietaryInfo(person),
        })))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-PT') || a.id.localeCompare(b.id));
}

/** Excel-compatible UTF-8 CSV; neutralize formulas, quote delimiters and multiline answers. */
export function dietaryCsv(rows: DietaryRow[]): string {
    const cell = (value: string) => {
        const safe = /^[\s]*[=+@-]/u.test(value) ? `'${value}` : value;
        return `"${safe.replace(/"/g, '""')}"`;
    };
    const labels = { declared: 'Com alergias / restrições', none: 'Sem alergias / restrições', pending: 'Por preencher' };
    return '\uFEFF' + [
        ['Nome', 'Alergias alimentares / restrições', 'Estado', 'Referência da inscrição'],
        ...rows.map(row => [row.full_name, row.details || (row.status === 'none' ? 'Sem alergias / restrições' : 'Por preencher'), labels[row.status], row.booking_id]),
    ].map(row => row.map(cell).join(';')).join('\r\n');
}
