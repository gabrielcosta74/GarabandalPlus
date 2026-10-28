import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { buildDietaryRows, dietaryCsv, type DietaryBooking } from '../../../../../../lib/pilgrimage-dietary';
import { supabaseServer } from '../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
    const { authorized } = await verifyAdmin(request);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers });
    const { pilgrimageId } = await params;
    try {
        const { data: pilgrimage, error } = await supabaseServer.from('pilgrimages')
            .select('id, title, slug').eq('id', pilgrimageId).maybeSingle();
        if (error) throw error;
        if (!pilgrimage) return NextResponse.json({ error: 'Peregrinação não encontrada.' }, { status: 404, headers });

        const bookings: DietaryBooking[] = [];
        for (let offset = 0; ; offset += 200) {
            const { data, error: loadError } = await supabaseServer.from('bookings')
                .select('id, status, pilgrims(id, full_name, allergies, dietary_restrictions)')
                .eq('pilgrimage_id', pilgrimageId).order('id').range(offset, offset + 199);
            if (loadError) throw loadError;
            bookings.push(...(data || []));
            if (!data || data.length < 200) break;
        }
        const rows = buildDietaryRows(bookings);
        if (new URL(request.url).searchParams.get('format') === 'csv') {
            const slug = pilgrimage.slug.replace(/[^a-z0-9-]/gi, '-');
            return new NextResponse(dietaryCsv(rows.filter(row => row.status === 'declared')), { headers: {
                ...headers,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="alergias-alimentares-${slug}.csv"`,
            } });
        }
        return NextResponse.json({ pilgrimage, rows }, { headers });
    } catch {
        return NextResponse.json({ error: 'Não foi possível carregar as alergias alimentares.' }, { status: 500, headers });
    }
}
