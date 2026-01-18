import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseServer } from '../../../../lib/supabase';
import Stripe from 'stripe';

export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("❌ STRIPE_WEBHOOK_SECRET is missing.");
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        const amountPaid = session.amount_total ? session.amount_total / 100 : 0; // Convert cents to EUR

        if (!bookingId) {
            console.error("❌ Webhook received without booking_id in metadata.");
            return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
        }

        console.log(`💰 [Webhook] Payment received for Booking ${bookingId}: ${amountPaid}€`);

        if (!supabaseServer) {
            console.error("❌ Supabase Server client not initialized");
            return NextResponse.json({ error: "Database Error" }, { status: 500 });
        }

        // 1. Fetch current booking state
        const { data: booking, error: fetchError } = await supabaseServer
            .from('bookings')
            .select('paid_amount, pilgrimage:pilgrimages(deposit_value)')
            .eq('id', bookingId)
            .single();

        if (fetchError || !booking) {
            console.error("❌ Booking not found:", fetchError);
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        const newPaidAmount = (booking.paid_amount || 0) + amountPaid;
        // booking.pilgrimage is a single object because of single().
        // TS might infer it as array if relationships aren't typed perfectly in legacy code, but single() returns object.
        // Let's cast or access safely.
        const depositValue = Array.isArray(booking.pilgrimage)
            ? booking.pilgrimage[0]?.deposit_value
            : (booking.pilgrimage as any)?.deposit_value || 0;

        // 2. Determine New Status
        // If they paid enough to cover deposit, verify status.
        let updates: any = {
            paid_amount: newPaidAmount,
            last_payment_date: new Date().toISOString()
        };

        if (newPaidAmount >= depositValue) {
            updates.status = 'confirmed'; // Auto-confirm if deposit is met
        }

        // 3. Update Booking
        const { error: updateError } = await supabaseServer
            .from('bookings')
            .update(updates)
            .eq('id', bookingId);

        if (updateError) {
            console.error("❌ Failed to update booking:", updateError);
            return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }

        // 4. Log Payment Transaction (Optional but good practice)
        // We could insert into a 'payments' table if it existed, but for now we update 'bookings'.

        console.log("✅ [Webhook] Booking updated successfully.");
    }

    return NextResponse.json({ received: true });
}
