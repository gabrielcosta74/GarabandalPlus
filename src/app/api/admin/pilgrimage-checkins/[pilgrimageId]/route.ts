/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { ensurePassesForBooking, isBookingFullyPaid } from '../../../../../lib/pilgrimage-passes';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> }
) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const { pilgrimageId } = await params;
    const { searchParams, origin } = new URL(req.url);
    const checkpointType = searchParams.get('checkpoint') || 'bus_boarding';

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    try {
        const { data: bookings, error: bookingsError } = await supabaseServer
            .from('bookings')
            .select(`
                id,
                status,
                total_amount,
                paid_amount,
                pilgrimage_id,
                pilgrimage:pilgrimages (
                    id,
                    title,
                    start_date,
                    end_date
                ),
                pilgrims (
                    id,
                    full_name,
                    email,
                    phone,
                    room_type,
                    flight_option,
                    allergies,
                    dietary_restrictions,
                    health_notes,
                    notes
                ),
                payments:pilgrimage_payments (
                    id,
                    amount,
                    status
                )
            `)
            .eq('pilgrimage_id', pilgrimageId)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: true });

        if (bookingsError) throw bookingsError;

        const eligibleBookings = (bookings || []).filter(isBookingFullyPaid);
        await Promise.all(eligibleBookings.map((booking: any) => ensurePassesForBooking(supabaseServer, booking, origin)));

        const { data: passRows, error: passesError } = await supabaseServer
            .from('pilgrim_passes')
            .select(`
                id,
                booking_id,
                pilgrim_id,
                status,
                issued_at,
                booking:bookings (
                    id,
                    status,
                    total_amount,
                    paid_amount
                ),
                pilgrim:pilgrims (
                    id,
                    full_name,
                    email,
                    phone,
                    room_type,
                    flight_option,
                    allergies,
                    dietary_restrictions,
                    health_notes,
                    notes
                )
            `)
            .eq('pilgrimage_id', pilgrimageId)
            .eq('status', 'active')
            .order('issued_at', { ascending: true });

        if (passesError) throw passesError;

        const passIds = (passRows || []).map((pass: any) => pass.id);
        const { data: acceptedRows, error: checkinsError } = passIds.length
            ? await supabaseServer
                .from('pilgrimage_checkins')
                .select('id, pass_id, created_at, admin_email')
                .eq('pilgrimage_id', pilgrimageId)
                .eq('checkpoint_type', checkpointType)
                .eq('result', 'accepted')
                .in('pass_id', passIds)
                .order('created_at', { ascending: false })
            : { data: [], error: null };

        if (checkinsError) throw checkinsError;

        const acceptedByPassId = new Map();
        (acceptedRows || []).forEach((row: any) => {
            if (!acceptedByPassId.has(row.pass_id)) acceptedByPassId.set(row.pass_id, row);
        });

        const people = (passRows || []).map((pass: any) => {
            const accepted = acceptedByPassId.get(pass.id);
            return {
                pass_id: pass.id,
                booking_id: pass.booking_id,
                pilgrim_id: pass.pilgrim_id,
                name: pass.pilgrim?.full_name || 'Sem nome',
                email: pass.pilgrim?.email || null,
                phone: pass.pilgrim?.phone || null,
                room_type: pass.pilgrim?.room_type || null,
                flight_option: pass.pilgrim?.flight_option || null,
                has_notes: Boolean(pass.pilgrim?.allergies || pass.pilgrim?.dietary_restrictions || pass.pilgrim?.health_notes || pass.pilgrim?.notes),
                checked_in: Boolean(accepted),
                checked_in_at: accepted?.created_at || null,
                checked_in_by: accepted?.admin_email || null,
            };
        });

        const checkedIn = people.filter((person: any) => person.checked_in).length;

        return NextResponse.json({
            checkpoint: checkpointType,
            stats: {
                expected: people.length,
                checked_in: checkedIn,
                missing: Math.max(0, people.length - checkedIn),
            },
            people,
        });
    } catch (err: any) {
        console.error('Pilgrimage checkins summary error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to load checkins' }, { status: 500 });
    }
}
