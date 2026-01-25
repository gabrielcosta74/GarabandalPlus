'use server'

import { createClient } from '@supabase/supabase-js';

export async function getPilgrimageDetailsAction(slug: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Server-side client
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });

    console.log(`⚡ [ServerAction] Fetching details for: ${slug}`);

    try {
        // 1. Fetch Main Pilgrimage Data (RPC)
        const { data: pData, error: pError } = await supabase
            .rpc('get_pilgrimage_list', { p_slug: slug })
            .maybeSingle();

        if (pError || !pData) {
            console.error("❌ [ServerAction] Main Data Error:", pError);
            return { error: "Pilgrimage not found" };
        }

        const pilgrimageId = (pData as any).id;

        // 2. Parallel Fetch for Related Data
        const [
            logisticsRes,
            testimonialsRes,
            stagesRes,
            itineraryRes,
            teamRes
        ] = await Promise.all([
            // Global Logistics
            supabase.from('site_content').select('content').eq('key', 'logistics_global').single(),
            // Testimonials
            supabase.from('testimonials').select('*').order('display_order'),
            // Stages
            supabase.from('pilgrimage_stages').select('*').eq('pilgrimage_id', pilgrimageId).order('display_order'),
            // Itinerary
            supabase.from('pilgrimage_itinerary_items').select('*').eq('pilgrimage_id', pilgrimageId).order('day_number'),
            // Team
            supabase.from('pilgrimage_team_members').select('*').eq('pilgrimage_id', pilgrimageId).order('display_order')
        ]);

        return {
            data: {
                pilgrimage: pData,
                globalLogistics: logisticsRes.data?.content || null,
                testimonials: testimonialsRes.data || [],
                stages: stagesRes.data || [],
                itineraryItems: itineraryRes.data || [],
                teamMembers: teamRes.data || []
            },
            error: null
        };
    } catch (e: any) {
        console.error("❌ [ServerAction] Exception:", e);
        return { error: e.message };
    }
}
