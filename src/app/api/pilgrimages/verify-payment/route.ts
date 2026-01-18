import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseServer } from '../../../../lib/supabase';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-04-10',
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
        }

        // 1. Fetch Session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ paid: false, status: session.payment_status });
        }

        const bookingId = session.metadata?.booking_id;
        const type = session.metadata?.type;
        let userId = session.metadata?.userId;

        if (type !== 'pilgrimage_payment' || !bookingId) {
            return NextResponse.json({ error: 'Invalid session type' }, { status: 400 });
        }

        if (!supabaseServer) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
        }

        // Fetch User ID from booking if missing in metadata
        if (!userId) {
            const { data: b } = await supabaseServer.from('bookings').select('user_id').eq('id', bookingId).single();
            if (b) userId = b.user_id;
        }

        // 2. FORCE UPDATE (Manual Webhook Logic)
        // Idempotently upsert payment
        const { error: payErr } = await supabaseServer
            .from('pilgrimage_payments')
            .upsert({
                booking_id: bookingId,
                user_id: userId,
                amount: (session.amount_total || 0) / 100,
                method: 'stripe',
                status: 'verified',
                payment_intent_id: session.payment_intent as string,
                external_reference: session.id,
            }, { onConflict: 'payment_intent_id' });

        if (payErr) {
            console.error('Verify Payment DB Error:', payErr);
            return NextResponse.json({ error: 'Database Write Error', details: payErr }, { status: 500 });
        }

        // 3. Recalculate Booking (Idempotent)
        const { data: payments } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount')
            .eq('booking_id', bookingId)
            .eq('status', 'verified');

        const totalPaid = payments?.reduce((acc, p) => acc + p.amount, 0) || 0;

        const { data: booking } = await supabaseServer
            .from('bookings')
            .select('total_amount')
            .eq('id', bookingId)
            .single();

        if (booking) {
            const isFullyPaid = totalPaid >= (booking.total_amount - 0.05);
            await supabaseServer
                .from('bookings')
                .update({
                    paid_amount: totalPaid,
                    status: isFullyPaid ? 'confirmed' : 'pending'
                })
                .eq('id', bookingId);
        }

        return NextResponse.json({ paid: true, totalPaid });

    } catch (err: any) {
        console.error('Verify Payment Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
