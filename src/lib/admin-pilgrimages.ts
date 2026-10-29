import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminPilgrimage = {
    id: string;
    title: string;
    slug: string;
    start_date: string;
    end_date: string;
    status: string;
    total_vacancies: number;
    current_vacancies: number;
    base_price: number;
    cover_image: string | null;
    checkin_form_enabled: boolean;
    confirmed_pax?: number;
    pending_pax?: number;
    effective_vacancies?: number;
};

export async function loadAdminPilgrimages(client: Pick<SupabaseClient, 'from'>): Promise<AdminPilgrimage[]> {
    // The occupancy view predates check-in settings. Read the authoritative flag
    // from the base table instead of assuming SELECT * on the view includes it.
    const [occupancy, settings] = await Promise.all([
        client.from('v_pilgrimages_with_occupancy').select('*').order('start_date', { ascending: true }),
        client.from('pilgrimages').select('id, checkin_form_enabled'),
    ]);
    if (occupancy.error) throw occupancy.error;
    if (settings.error) throw settings.error;

    const checkinById = new Map<string, boolean>((settings.data || []).map(row => [row.id, row.checkin_form_enabled === true]));
    return ((occupancy.data || []) as Omit<AdminPilgrimage, 'checkin_form_enabled'>[]).map(row => ({
        ...row,
        checkin_form_enabled: checkinById.get(row.id) === true,
    }));
}
