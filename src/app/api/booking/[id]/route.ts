import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const id = params.id;

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        // Fetch booking using Service Role (via supabaseServer) to bypass RLS 
        // strictly for the public/success view. We only return what's necessary.
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
                    pricing_config
                ),
                pilgrims (*),
                payments:pilgrimage_payments (*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error("❌ [API Booking GET] Error:", error);
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        return NextResponse.json(booking);

    } catch (error: any) {
        console.error("🚨 [API Booking GET] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
