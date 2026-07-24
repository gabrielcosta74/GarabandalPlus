import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> },
) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json(
            { error: authError || 'Unauthorized' },
            { status, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    if (!supabaseServer) {
        return NextResponse.json(
            { error: 'Server not configured' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const { pilgrimageId } = await params;
    const { data: pilgrimage, error: pilgrimageError } = await supabaseServer
        .from('pilgrimages')
        .select('*')
        .eq('id', pilgrimageId)
        .single();

    if (pilgrimageError || !pilgrimage) {
        return NextResponse.json(
            { error: 'Pilgrimage not found' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const [logisticsResult, stagesResult, itineraryResult, teamResult] = await Promise.all([
        supabaseServer
            .from('site_content')
            .select('content')
            .eq('key', 'logistics_global')
            .maybeSingle(),
        supabaseServer
            .from('pilgrimage_stages')
            .select('*')
            .eq('pilgrimage_id', pilgrimageId)
            .order('display_order'),
        supabaseServer
            .from('pilgrimage_itinerary_items')
            .select('*')
            .eq('pilgrimage_id', pilgrimageId)
            .order('day_number'),
        supabaseServer
            .from('pilgrimage_team_members')
            .select('*')
            .eq('pilgrimage_id', pilgrimageId)
            .order('display_order'),
    ]);

    const relatedError = [
        logisticsResult.error,
        stagesResult.error,
        itineraryResult.error,
        teamResult.error,
    ].find(Boolean);

    if (relatedError) {
        return NextResponse.json(
            { error: relatedError.message },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    return NextResponse.json(
        {
            pilgrimage,
            globalLogistics: logisticsResult.data?.content || null,
            stages: stagesResult.data || [],
            itineraryItems: itineraryResult.data || [],
            teamMembers: teamResult.data || [],
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
