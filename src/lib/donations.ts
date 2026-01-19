import { cache } from 'react';
import { supabaseServer } from './supabase';

export type DonationMeta = {
    goal: number;
    raised: number;
};

export const loadMeta = cache(async (): Promise<DonationMeta> => {
    // If running on server with Service Key, query DB directly
    if (supabaseServer) {
        try {
            const { data: metaRow } = await supabaseServer
                .from('donations_meta')
                .select('goal_eur, raised_eur')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (metaRow) {
                return {
                    goal: Number(metaRow.goal_eur ?? 2500),
                    raised: Number(metaRow.raised_eur ?? 0)
                };
            }
        } catch (e) {
            console.error('Error fetching meta via supabaseServer:', e);
        }
        return { goal: 2500, raised: 0 };
    }

    // Fallback if no server client (should not happen in RSC) or legacy mode
    return { goal: 2500, raised: 0 };
});

export const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(value);
