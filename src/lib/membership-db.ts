import { SupabaseClient } from '@supabase/supabase-js';

export const getNextMemberNumber = async (supabaseServer: SupabaseClient) => {
    const pageSize = 1000;
    let from = 0;
    let maxNumber = 0;

    while (true) {
        const { data, error } = await supabaseServer
            .from('membros')
            .select('numero_socio')
            .not('numero_socio', 'is', null)
            .range(from, from + pageSize - 1);

        if (error) throw error;
        const rows = data || [];
        if (!rows.length) break;

        for (const row of rows) {
            const current = Number((row as any)?.numero_socio ?? 0);
            if (Number.isFinite(current) && current > maxNumber) {
                maxNumber = current;
            }
        }

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    return maxNumber + 1;
};
