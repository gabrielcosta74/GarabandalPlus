import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '../../../../../lib/supabase';
import { isPreLaunch } from '../../../../../lib/pilgrimage-early-access';
import { earlyAccessCookieName, verifyEarlyAccessToken } from '../../../../../lib/early-access-token';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

// Gated full-content endpoint for a pre-launch pilgrimage. Returns the complete
// payload (mirrors the admin preview route) only when the request carries a
// valid early-access grant cookie. Once the pilgrimage is public this simply
// serves the data — the public RPC would too.
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'server' }, { status: 500, headers: noStore });
    }

    const { slug } = await params;
    const { data: pilgrimage, error } = await supabaseServer
        .from('pilgrimages')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

    if (error || !pilgrimage) {
        return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
    }

    if (isPreLaunch(pilgrimage)) {
        const cookieStore = await cookies();
        const token = cookieStore.get(earlyAccessCookieName(pilgrimage.id))?.value;
        if (!verifyEarlyAccessToken(token, pilgrimage.id)) {
            return NextResponse.json({ error: 'locked' }, { status: 403, headers: noStore });
        }
    }

    const [logisticsResult, stagesResult, itineraryResult, teamResult] = await Promise.all([
        supabaseServer.from('site_content').select('content').eq('key', 'logistics_global').maybeSingle(),
        supabaseServer.from('pilgrimage_stages').select('*').eq('pilgrimage_id', pilgrimage.id).order('display_order'),
        supabaseServer.from('pilgrimage_itinerary_items').select('*').eq('pilgrimage_id', pilgrimage.id).order('day_number'),
        supabaseServer.from('pilgrimage_team_members').select('*').eq('pilgrimage_id', pilgrimage.id).order('display_order'),
    ]);

    return NextResponse.json(
        {
            pilgrimage,
            globalLogistics: logisticsResult.data?.content || null,
            stages: stagesResult.data || [],
            itineraryItems: itineraryResult.data || [],
            teamMembers: teamResult.data || [],
        },
        { headers: noStore },
    );
}
