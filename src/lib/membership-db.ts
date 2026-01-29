import { SupabaseClient } from '@supabase/supabase-js';

export const getNextMemberNumber = async (supabaseServer: SupabaseClient) => {
    const { data, error } = await supabaseServer
        .from('membros')
        .select('numero_socio')
        .not('numero_socio', 'is', null)
        .order('numero_socio', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    const current = Number(data?.numero_socio ?? 0);
    return Number.isFinite(current) && current > 0 ? current + 1 : 1;
};
