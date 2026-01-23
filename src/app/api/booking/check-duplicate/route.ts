import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function POST(req: Request) {
    try {
        if (!supabaseServer) {
            return NextResponse.json({ error: "Config Error" }, { status: 500 });
        }

        const { email, pilgrimageId } = await req.json();

        if (!email || !pilgrimageId) {
            return NextResponse.json({ exists: false });
        }

        // STRATEGY CHANGE: 
        // Instead of searching Auth Users (which is slow/limited), we search the 'pilgrims' table directly.
        // If a pilgrim exists with this email for this pilgrimage, it's a duplicate.
        // This catches both "User Accounts" and "Guests" who reused the email.

        const { data: pilgrims, error } = await supabaseServer
            .from('pilgrims')
            .select('id, booking_id, booking:bookings!inner(pilgrimage_id, status)')
            .eq('email', email)
            .eq('booking.pilgrimage_id', pilgrimageId)
            .neq('booking.status', 'cancelled');

        if (error) {
            console.error("Duplicate Check Error (Query):", error);
            // Fallback: If query fails (e.g. relation issue), return false to not block
            return NextResponse.json({ exists: false });
        }

        if (pilgrims && pilgrims.length > 0) {
            // Found a duplicate! Return true AND the booking_id so we can redirect.
            return NextResponse.json({
                exists: true,
                booking_id: pilgrims[0].booking_id,
                email: email // Include email for UI comparison
            });
        }

        return NextResponse.json({ exists: false });

    } catch (error) {
        console.error("Duplicate Check Error:", error);
        return NextResponse.json({ exists: false }); // Fail safe (allow booking)
    }
}
