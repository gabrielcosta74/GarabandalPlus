import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

/**
 * GET /api/admin/bookings/[pilgrimageId]
 * 
 * Admin-only endpoint to fetch bookings with payments for a pilgrimage
 * Uses service role to bypass RLS
 */
export async function GET(
    req: Request,
    { params }: { params: { pilgrimageId: string } }
) {
    const pilgrimageId = params.pilgrimageId;

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    try {
        // Fetch bookings with all related data using service role
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
                    base_price
                )
            `)
            .eq('pilgrimage_id', pilgrimageId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching bookings:', error);
            throw error;
        }

        return NextResponse.json({ bookings: bookings || [] });
    } catch (err: any) {
        console.error('Admin bookings fetch error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to fetch bookings' },
            { status: 500 }
        );
    }
}
