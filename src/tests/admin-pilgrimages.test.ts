import { describe, expect, it, vi } from 'vitest';
import { loadAdminPilgrimages } from '../lib/admin-pilgrimages';

function setup(settingsError: unknown = null, occupancyError: unknown = null) {
    const rows = [
        { id: 'november', title: 'Novembro', confirmed_pax: 63, effective_vacancies: 0 },
        { id: 'italy', title: 'Itália', confirmed_pax: 78, effective_vacancies: 0 },
        { id: 'october', title: 'Outubro', confirmed_pax: 20, effective_vacancies: 37 },
    ];
    // Deliberately no checkin_form_enabled in the legacy view, just like production.
    const order = vi.fn().mockResolvedValue({ data: rows, error: occupancyError });
    const settingsSelect = vi.fn().mockResolvedValue({ data: [
        { id: 'october', checkin_form_enabled: true },
        { id: 'italy', checkin_form_enabled: false },
        { id: 'november', checkin_form_enabled: true },
    ], error: settingsError });
    const viewSelect = vi.fn().mockReturnValue({ order });
    const from = vi.fn((table: string) => ({ select: table === 'pilgrimages' ? settingsSelect : viewSelect }));
    const client = { from } as unknown as Parameters<typeof loadAdminPilgrimages>[0];
    return { client, rows, settingsSelect, order };
}

describe('admin pilgrimage listing with legacy occupancy view', () => {
    it('restores check-in only for enabled trips, matching by ID rather than row order', async () => {
        const { client, settingsSelect, order } = setup();
        const rows = await loadAdminPilgrimages(client);
        expect(rows.filter(row => row.checkin_form_enabled).map(row => row.id)).toEqual(['november', 'october']);
        expect(settingsSelect).toHaveBeenCalledWith('id, checkin_form_enabled');
        expect(order).toHaveBeenCalledWith('start_date', { ascending: true });
    });

    it('preserves occupancy and vacancy data used by the admin cards', async () => {
        const { client, rows } = setup();
        const result = await loadAdminPilgrimages(client);
        for (let index = 0; index < rows.length; index++) expect(result[index]).toMatchObject(rows[index]);
    });

    it('reports settings failures instead of silently making all check-in links disappear', async () => {
        const error = { message: 'Settings unavailable' };
        await expect(loadAdminPilgrimages(setup(error).client)).rejects.toBe(error);
    });

    it('reports occupancy failures instead of treating them as an empty list', async () => {
        const error = { message: 'Occupancy unavailable' };
        await expect(loadAdminPilgrimages(setup(null, error).client)).rejects.toBe(error);
    });
});
