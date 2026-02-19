import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'booking-check-duplicate',
            windowMs: 60_000,
            max: 30
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { exists: false },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
                }
            );
        }

        const host = req.headers.get('host') || '';
        const origin = req.headers.get('origin') || '';
        const referer = req.headers.get('referer') || '';
        const isDev = process.env.NODE_ENV === 'development';
        const isInternalRequest = !!host && (origin.includes(host) || referer.includes(host));

        // Basic anti-scraping guard for public endpoint.
        if (!isDev && !isInternalRequest) {
            return NextResponse.json({ exists: false });
        }

        if (!supabaseServer) {
            return NextResponse.json({ error: "Config Error" }, { status: 500 });
        }

        const payload = await req.json().catch(() => ({}));
        const email = normalizeEmail(payload?.email);
        const pilgrimageId = typeof payload?.pilgrimageId === 'string' ? payload.pilgrimageId : '';

        if (!email || !pilgrimageId) {
            return NextResponse.json({ exists: false });
        }

        // STRATEGY CHANGE: 
        // Instead of searching Auth Users (which is slow/limited), we search the 'pilgrims' table directly.
        // If a pilgrim exists with this email for this pilgrimage, it's a duplicate.
        // This catches both "User Accounts" and "Guests" who reused the email.

        const { data: pilgrims, error } = await supabaseServer
            .from('pilgrims')
            .select('id, booking:bookings!inner(pilgrimage_id, status)')
            .eq('email', email)
            .eq('booking.pilgrimage_id', pilgrimageId)
            .neq('booking.status', 'cancelled');

        if (error) {
            console.error("Duplicate Check Error (Query):", error);
            // Fallback: If query fails (e.g. relation issue), return false to not block
            return NextResponse.json({ exists: false });
        }

        if (pilgrims && pilgrims.length > 0) {
            // Do not expose booking identifiers to unauthenticated clients.
            return NextResponse.json({
                exists: true,
                email
            });
        }

        return NextResponse.json({ exists: false });

    } catch (error) {
        console.error("Duplicate Check Error:", error);
        return NextResponse.json({ exists: false }); // Fail safe (allow booking)
    }
}
