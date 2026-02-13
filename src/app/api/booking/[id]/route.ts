import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { createSupabaseServerClient } from '../../../../lib/auth-utils';

/**
 * GET /api/booking/[id]
 * 
 * SECURITY: Two access modes:
 * 1. Public view with secure token (for success page) - returns limited data
 * 2. Authenticated user view (owns booking) - returns full data
 */
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const id = params.id;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const successfulStatuses = ['verified', 'succeeded', 'paid', 'manual'];
        const normalizeBookingPaidAmount = async (booking: any) => {
            if (!booking) return booking;

            const payments = Array.isArray(booking.payments) ? booking.payments : [];
            const successfulPaidTotal = payments
                .filter((p: any) => successfulStatuses.includes(String(p?.status || '').toLowerCase()))
                .reduce((sum: number, p: any) => sum + (Number(p?.amount) || 0), 0);

            const currentPaid = Number(booking.paid_amount) || 0;
            const normalizedPaid = Math.max(currentPaid, successfulPaidTotal);
            booking.paid_amount = normalizedPaid;

            if (Math.abs(currentPaid - normalizedPaid) > 0.009) {
                await supabaseServer!
                    .from('bookings')
                    .update({ paid_amount: normalizedPaid, last_payment_date: new Date().toISOString() })
                    .eq('id', booking.id);
            }

            return booking;
        };

        // MODE 1: Token-based public view (for success page after booking)
        if (token) {
            console.log("🔑 [API] Token-based access attempt");
            console.log("🆔 [API] Booking ID:", id);
            console.log("🎫 [API] Token:", token.substring(0, 20) + "...");
            console.log("🔧 [API] supabaseServer exists?", !!supabaseServer);

            const { data: booking, error } = await supabaseServer
                .from('bookings')
                .select(`
                    *,
                    pilgrimage:pilgrimages (
                        title,
                        start_date,
                        end_date,
                        cover_image,
                        deposit_value
                    ),
                    pilgrims (*),
                    payments:pilgrimage_payments (
                        id,
                        amount,
                        status,
                        method,
                        notes,
                        created_at
                    )
                `)
                .eq('id', id)
                .eq('view_token', token)
                .single();

            console.log("📊 [API] Query result - Error:", error);
            console.log("📊 [API] Query result - Data:", booking ? "Found" : "Not found");
            console.log("👥 [API] Pilgrims count:", booking?.pilgrims?.length || 0);

            if (error || !booking) {
                console.error("❌ [API Booking GET] Invalid token or query failed");
                console.error("❌ [API] Error details:", JSON.stringify(error));
                return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
            }

            if (booking?.payments) {
                console.log(`[API] Token Access: Loaded ${booking.payments.length} payments`);
                booking.payments = booking.payments.map((p: any) => ({
                    ...p,
                    amount: Number(p.amount)
                }));
            }

            await normalizeBookingPaidAmount(booking);

            console.log("✅ [API] Booking found with token, returning data");
            return NextResponse.json(booking);
        }

        // MODE 2: Authenticated user view (full data)
        const supabase = createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("❌ [API Booking GET] Unauthorized access attempt");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use regular client with RLS - will only return if user owns booking
        const { data: booking, error } = await supabase
            .from('bookings')
            .select(`
                *,
                pilgrimage:pilgrimages (
                    title, 
                    start_date, 
                    end_date, 
                    cover_image, 
                    deposit_value,
                    base_price,
                    pricing_config
                ),
                pilgrims (*),
                payments:pilgrimage_payments (
                    id,
                    amount,
                    method,
                    status,
                    created_at,
                    notes,
                    receipt_url
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error("❌ [API Booking GET] Error:", error);
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        if (booking?.payments) {
            console.log(`[API Booking] Loaded ${booking.payments.length} payments for ${id}`);
            // Ensure amounts are numbers
            booking.payments = booking.payments.map((p: any) => ({
                ...p,
                amount: Number(p.amount)
            }));
        }

        await normalizeBookingPaidAmount(booking);

        return NextResponse.json(booking);

    } catch (error: any) {
        console.error("🚨 [API Booking GET] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
