import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/auth-utils';
import { supabaseServer } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const sessionClient = await createSupabaseServerClient();
    const {
        data: { user },
        error: authError,
    } = await sessionClient.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json(
            { error: 'Serviço temporariamente indisponível.' },
            { status: 503 },
        );
    }

    // Private test pilgrimages are intentionally hidden by pilgrimage RLS.
    // The service-role query is safe here because ownership is constrained to
    // the authenticated user before any booking data is returned.
    const { data, error } = await supabaseServer
        .from('bookings')
        .select(`
            id,
            paid_amount,
            total_amount,
            status,
            created_at,
            pilgrimage:pilgrimages!inner (
                title,
                slug,
                start_date,
                end_date,
                cover_image
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[API Booking List] Failed to load bookings:', error);
        return NextResponse.json(
            { error: 'Não foi possível carregar as inscrições.' },
            { status: 502 },
        );
    }

    return NextResponse.json(
        { bookings: data ?? [] },
        { headers: { 'Cache-Control': 'private, no-store' } },
    );
}
