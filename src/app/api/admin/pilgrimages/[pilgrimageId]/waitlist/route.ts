import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: { pilgrimageId: string } }
) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const { pilgrimageId } = params;

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    try {
        const { data: waitlist, error } = await supabaseServer
            .from('pilgrimage_waitlists')
            .select('*')
            .eq('pilgrimage_id', pilgrimageId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ waitlist: waitlist || [] });

    } catch (err: any) {
        console.error("Error fetching waitlist:", err);
        return NextResponse.json(
            { error: err.message || 'Failed to fetch waitlist' },
            { status: 500 }
        );
    }
}
