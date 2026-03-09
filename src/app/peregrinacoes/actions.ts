'use server'

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { getCivilDateTimestamp } from '../../lib/utils';

const getPilgrimagesCached = unstable_cache(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // We create a new client for the server action context
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });

    console.log("⚡ [ServerAction] Fetching pilgrimages...");

    try {
        const [{ data: rpcData, error: rpcError }, { data: tableData, error: tableError }] = await Promise.all([
            supabase.rpc('get_pilgrimage_list', {}),
            supabase.from('pilgrimages').select('*').order('start_date', { ascending: true }),
        ]);

        if (tableError) {
            console.error("❌ [ServerAction] Table query failed:", tableError);
        }
        if (rpcError) {
            console.warn("⚠️ [ServerAction] RPC failed:", rpcError);
        }

        const rpcList = Array.isArray(rpcData) ? rpcData : [];
        const tableList = Array.isArray(tableData) ? tableData : [];

        // Prefer table data when it has more rows than RPC.
        // This prevents stale/over-filtered SQL functions from hiding pilgrimages.
        const chosenRaw = tableList.length > rpcList.length ? tableList : rpcList;
        const chosen = Array.from(
            new Map(chosenRaw.map((row: any) => [row.id, row])).values()
        ).sort((a: any, b: any) => {
            const aDate = getCivilDateTimestamp(a?.start_date);
            const bDate = getCivilDateTimestamp(b?.start_date);
            return aDate - bDate;
        });

        if (tableList.length > rpcList.length) {
            console.warn(`⚠️ [ServerAction] RPC returned ${rpcList.length}, table returned ${tableList.length}. Using table data.`);
        } else {
            console.log(`✅ [ServerAction] Using RPC data (${rpcList.length})`);
        }

        return { data: chosen, error: null };
    } catch (e: any) {
        console.error("❌ [ServerAction] Exception:", e);
        return { data: [], error: e.message };
    }
}, ['pilgrimage-list'], { revalidate: 300 });

export async function getPilgrimagesAction() {
    return getPilgrimagesCached();
}
