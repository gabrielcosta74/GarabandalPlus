import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { toSignedReceiptUrl } from '../../../../../lib/receipt-utils';

/**
 * GET /api/admin/bookings/[pilgrimageId]
 * 
 * Admin-only endpoint to fetch bookings with payments for a pilgrimage
 * Uses service role to bypass RLS
 */
import { verifyAdmin } from '../../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: { pilgrimageId: string } }
) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const pilgrimageId = params.pilgrimageId;

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    try {
        // Fetch bookings with related data using service role
        const { data: bookings, error } = await supabaseServer
            .from('bookings')
            .select(`
                id,
                status,
                created_at,
                paid_amount,
                total_amount,
                payment_plan,
                pilgrims (
                    id,
                    full_name,
                    email,
                    phone,
                    flight_option,
                    room_type,
                    allergies,
                    dietary_restrictions,
                    health_notes,
                    birth_date,
                    sex,
                    address,
                    postal_code,
                    city,
                    country,
                    notes,
                    cpf_nif
                ),
                payments:pilgrimage_payments (
                    id,
                    amount,
                    method,
                    status,
                    receipt_url,
                    notes,
                    created_at,
                    verified_at
                ),
                pilgrimage:pilgrimages (
                    id,
                    title,
                    deposit_value,
                    base_price,
                    total_vacancies
                )
            `)
            .eq('pilgrimage_id', pilgrimageId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching bookings:', error);
            throw error;
        }

        const safeBookings = bookings || [];

        if (safeBookings.length === 0) {
            return NextResponse.json({ bookings: [] });
        }

        const bookingIds = safeBookings.map((b) => b.id);
        const { data: payments, error: paymentsError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('id, booking_id, amount, method, status, receipt_url, notes, created_at, verified_at')
            .in('booking_id', bookingIds);

        if (paymentsError) {
            console.error('Error fetching payments:', paymentsError);
            return NextResponse.json({ bookings: safeBookings });
        }

        const signedPayments = await Promise.all((payments || []).map(async (payment: any) => ({
            ...payment,
            receipt_url: payment?.receipt_url ? await toSignedReceiptUrl(payment.receipt_url, 3600) : null,
        })));

        const paymentsByBookingId = signedPayments.reduce<Record<string, any[]>>((acc, payment) => {
            if (!acc[payment.booking_id]) acc[payment.booking_id] = [];
            acc[payment.booking_id].push(payment);
            return acc;
        }, {});

        const verifiedStatuses = new Set(['verified', 'succeeded', 'paid', 'manual']);

        const hydratedBookings = safeBookings.map((booking) => {
            const bookingPayments = paymentsByBookingId[booking.id] || [];
            const verifiedTotal = bookingPayments
                .filter((p) => verifiedStatuses.has(String(p.status || '').toLowerCase()))
                .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const currentPaid = Number(booking.paid_amount) || 0;

            return {
                ...booking,
                payments: bookingPayments,
                paid_amount: Math.max(currentPaid, verifiedTotal)
            };
        });

        return NextResponse.json({ bookings: hydratedBookings });
    } catch (err: any) {
        console.error('Admin bookings fetch error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to fetch bookings' },
            { status: 500 }
        );
    }
}
