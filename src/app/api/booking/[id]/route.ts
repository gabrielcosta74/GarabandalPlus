import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { createSupabaseServerClient } from '../../../../lib/auth-utils';
import { toSignedReceiptUrl } from '../../../../lib/receipt-utils';
import { loadPilgrimageBillingProfile } from '../../../../lib/pilgrimage-billing';

type BookingPaymentRecord = {
    id: string;
    amount: number | string | null;
    status?: string | null;
    receipt_url?: string | null;
    [key: string]: unknown;
};

type BookingRecord = {
    id: string;
    paid_amount?: number | string | null;
    payments?: BookingPaymentRecord[] | null;
    [key: string]: unknown;
};

type FactPtPaymentStatus = {
    status: string | null;
    factpt_number: string | null;
    issued_at: string | null;
    email_sent_at: string | null;
};

/**
 * Logistics fields shown in the "trip" tab of the private booking page.
 * Kept in one place so the token and authenticated selects stay in sync.
 */
const PILGRIMAGE_TRIP_FIELDS = `
    slug,
    meeting_point_text,
    meeting_point_text_en,
    meeting_end_text,
    meeting_end_text_en,
    flight_departure_time,
    flight_return_time,
    flight_info_text,
    flight_info_text_en,
    group_flight_details,
    group_flight_details_en,
    flight_price_from,
    itinerary_summary,
    itinerary_summary_en,
    included_items,
    included_items_en,
    not_included_items,
    not_included_items_en
`;

/**
 * GET /api/booking/[id]
 * 
 * SECURITY: Two access modes:
 * 1. Public view with secure token (for success page) - returns limited data
 * 2. Authenticated user view (owns booking) - returns full data
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
            const successfulStatuses = ['verified', 'succeeded', 'paid', 'manual'];
            const attachFactPtStatus = async (booking: BookingRecord) => {
                const paymentIds = (booking?.payments || [])
                    .map((payment) => payment.id)
                    .filter((paymentId: unknown): paymentId is string => typeof paymentId === 'string');
                if (paymentIds.length === 0) return booking;

                const { data: fiscalDocuments, error: fiscalError } = await supabaseServer!
                    .from('factpt_documents')
                    .select('source_id, status, factpt_number, issued_at, email_sent_at, created_at')
                    .eq('source_type', 'pilgrimage')
                    .in('source_id', paymentIds)
                    .order('created_at', { ascending: false });

                if (fiscalError) {
                    console.error('[API Booking] FACT.pt status lookup failed:', fiscalError);
                    return booking;
                }

                const latestByPayment = new Map<string, FactPtPaymentStatus>();
                for (const document of fiscalDocuments || []) {
                    if (!latestByPayment.has(document.source_id)) {
                        latestByPayment.set(document.source_id, {
                            status: document.status,
                            factpt_number: document.factpt_number,
                            issued_at: document.issued_at,
                            email_sent_at: document.email_sent_at,
                        });
                    }
                }

                booking.payments = (booking.payments || []).map((payment) => ({
                    ...payment,
                    factpt_document: latestByPayment.get(payment.id) || null,
                }));
                return booking;
            };

            const normalizeBookingPaidAmount = async (booking: BookingRecord) => {
                if (!booking) return booking;

            const payments = Array.isArray(booking.payments) ? booking.payments : [];
            const successfulPaidTotal = payments
                .filter((payment) => successfulStatuses.includes(String(payment.status || '').toLowerCase()))
                .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

                const currentPaid = Number(booking.paid_amount) || 0;
                const normalizedPaid = Math.max(currentPaid, successfulPaidTotal);
                booking.paid_amount = normalizedPaid;

                if (Math.abs(currentPaid - normalizedPaid) > 0.009) {
                    await supabaseServer!
                        .from('bookings')
                        .update({ paid_amount: normalizedPaid, updated_at: new Date().toISOString() })
                        .eq('id', booking.id);
                }

                if (payments.length > 0) {
                    booking.payments = await Promise.all(payments.map(async (payment) => ({
                        ...payment,
                        receipt_url: payment?.receipt_url ? await toSignedReceiptUrl(payment.receipt_url, 3600) : null,
                    })));
                }

                return booking;
            };

            /**
             * Day-by-day itinerary for the trip tab. Read with the service role so
             * private pilgrimages (hidden by RLS) still show logistics to their own
             * pilgrims. Failures degrade to an empty list — never block the booking.
             */
            const attachItinerary = async (booking: BookingRecord) => {
                booking.itinerary = [];
                const pilgrimageId = booking?.pilgrimage_id;
                if (typeof pilgrimageId !== 'string' || !pilgrimageId) return booking;

                const { data: itinerary, error: itineraryError } = await supabaseServer!
                    .from('pilgrimage_itinerary_items')
                    .select('id, title, title_en, description, description_en, day_number, display_order')
                    .eq('pilgrimage_id', pilgrimageId)
                    .order('day_number', { ascending: true })
                    .order('display_order', { ascending: true });

                if (itineraryError) {
                    console.error('[API Booking] Itinerary lookup failed:', itineraryError);
                    return booking;
                }

                booking.itinerary = itinerary || [];
                return booking;
            };

            const attachBillingProfile = async (booking: BookingRecord) => {
                try {
                    booking.billing_profile = await loadPilgrimageBillingProfile(
                        supabaseServer!,
                        booking as BookingRecord & { user_id: string; pilgrims?: Array<Record<string, unknown>> },
                    );
                } catch (billingError) {
                    console.error('[API Booking] Billing profile lookup failed:', billingError);
                    booking.billing_profile = null;
                }
                return booking;
            };

        // MODE 1: Token-based public view (for success page after booking)
        if (token) {
            console.log("🔑 [API] Token-based access attempt");
            console.log("🆔 [API] Booking ID:", id);
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
                        deposit_value,
                        pricing_config,
                        ${PILGRIMAGE_TRIP_FIELDS}
                    ),
                    pilgrims (*),
                    payments:pilgrimage_payments (
                        id,
                        amount,
                        status,
                        method,
                        notes,
                        external_reference,
                        processing_fee_amount,
                        charged_amount,
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
                booking.payments = booking.payments.map((payment: BookingPaymentRecord) => ({
                    ...payment,
                    amount: Number(payment.amount)
                }));
            }

            await normalizeBookingPaidAmount(booking);
            await attachFactPtStatus(booking);
            await attachBillingProfile(booking);
            await attachItinerary(booking);

            console.log("✅ [API] Booking found with token, returning data");
            return NextResponse.json(booking);
        }

        // MODE 2: Authenticated user view (full data)
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("❌ [API Booking GET] Unauthorized access attempt");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // The server client is required for private test pilgrimages, which are
        // deliberately hidden by pilgrimage RLS. Ownership is enforced in the
        // same query so the service role never broadens what the user can read.
        const { data: booking, error } = await supabaseServer
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
                    pricing_config,
                    ${PILGRIMAGE_TRIP_FIELDS}
                ),
                pilgrims (*),
                payments:pilgrimage_payments (
                    id,
                    amount,
                    method,
                    status,
                    created_at,
                    notes,
                    external_reference,
                    processing_fee_amount,
                    charged_amount,
                    receipt_url
                )
            `)
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error("❌ [API Booking GET] Error:", error);
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        if (booking?.payments) {
            console.log(`[API Booking] Loaded ${booking.payments.length} payments for ${id}`);
            // Ensure amounts are numbers
            booking.payments = booking.payments.map((payment: BookingPaymentRecord) => ({
                ...payment,
                amount: Number(payment.amount)
            }));
        }

        await normalizeBookingPaidAmount(booking);
        await attachFactPtStatus(booking);
        await attachBillingProfile(booking);
        await attachItinerary(booking);

        return NextResponse.json(booking);

    } catch (error: unknown) {
        console.error("🚨 [API Booking GET] Critical Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 },
        );
    }
}
