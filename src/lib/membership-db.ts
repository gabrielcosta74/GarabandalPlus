import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeQuotaStatus } from './membership-status';

export const getNextMemberNumber = async (supabaseServer: SupabaseClient) => {
    const pageSize = 1000;
    let from = 0;
    let maxNumber = 0;

    while (true) {
        const { data, error } = await supabaseServer
            .from('membros')
            .select('numero_socio, is_membro, estado_quota')
            .not('numero_socio', 'is', null)
            .order('numero_socio', { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) throw error;
        const rows = data || [];
        if (!rows.length) break;

        for (const row of rows) {
            const isActiveMember = !!(row as any)?.is_membro;
            const quotaStatus = normalizeQuotaStatus((row as any)?.estado_quota);

            // Pending/non-member placeholders must not reserve the next member number.
            if (!isActiveMember && quotaStatus === 'pendente') {
                continue;
            }

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
