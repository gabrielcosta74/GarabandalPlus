/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { createSupabaseServerClient } from '../../../../../lib/auth-utils';
import { ensurePassesForBooking, isBookingFullyPaid } from '../../../../../lib/pilgrimage-passes';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(
    req: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    const { bookingId } = await params;
    const { searchParams, origin } = new URL(req.url);
    const token = searchParams.get('token');

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    try {
        let query = supabaseServer
            .from('bookings')
            .select(`
                id,
                user_id,
                pilgrimage_id,
                status,
                total_amount,
                paid_amount,
                view_token,
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
            .eq('id', bookingId);

        if (token) {
            query = query.eq('view_token', token);
        }

        const { data: booking, error } = await query.maybeSingle();

        if (error) throw error;
        if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

        if (!token) {
            const supabase = await createSupabaseServerClient();
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user || booking.user_id !== user.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        if (String(booking.status || '').toLowerCase() === 'cancelled') {
            return NextResponse.json({
                available: false,
                reason: 'cancelled',
                message: 'Esta inscrição foi cancelada.',
                passes: [],
            });
        }

        if (!isBookingFullyPaid(booking)) {
            return NextResponse.json({
                available: false,
                reason: 'payment_pending',
                message: 'O Passe de Peregrino fica disponível quando a inscrição estiver totalmente paga.',
                passes: [],
                paid_amount: Number(booking.paid_amount) || 0,
                total_amount: Number(booking.total_amount) || 0,
            });
        }

        const passes = await ensurePassesForBooking(supabaseServer, booking, origin);

        return NextResponse.json({
            available: true,
            booking: {
                id: booking.id,
                pilgrimage_id: booking.pilgrimage_id,
                pilgrimage: booking.pilgrimage,
            },
            passes,
        });
    } catch (err: any) {
        console.error('Pilgrimage pass fetch error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to load pilgrim pass' }, { status: 500 });
    }
}
