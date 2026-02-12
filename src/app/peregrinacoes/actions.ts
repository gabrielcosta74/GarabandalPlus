'use server'

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';

const getPilgrimagesCached = unstable_cache(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // We create a new client for the server action context
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });

    console.log("⚡ [ServerAction] Fetching pilgrimages...");

    try {
        // 1. Try RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_pilgrimage_list', {});

        if (!rpcError && rpcData) {
            console.log("✅ [ServerAction] RPC Success:", rpcData.length);
            return { data: rpcData, error: null };
        }

        console.warn("⚠️ [ServerAction] RPC Failed/Empty, trying fallback:", rpcError);

        // 2. Fallback
        const { data: tableData, error: tableError } = await supabase
            .from('pilgrimages')
            .select('*')
            .order('start_date', { ascending: true });

        if (tableError) {
            console.error("❌ [ServerAction] Table Fallback Failed:", tableError);
            return { data: [], error: tableError.message };
        }

        console.log("✅ [ServerAction] Table Fallback Success:", tableData?.length);
        return { data: tableData, error: null };

    } catch (e: any) {
        console.error("❌ [ServerAction] Exception:", e);
        return { data: [], error: e.message };
    }
}, ['pilgrimage-list'], { revalidate: 300 });

export async function getPilgrimagesAction() {
    return getPilgrimagesCached();
}
