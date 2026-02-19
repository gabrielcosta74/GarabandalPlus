import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../../../../lib/rate-limit';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-04-10',
});

// Initialize Supabase Admin (for fetching booking amount securely)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
    try {
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'pilgrimages-checkout',
            windowMs: 60_000,
            max: 20
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
                }
            );
        }

        const { bookingId, returnUrl, amount } = await req.json();

        if (!bookingId || !returnUrl) {
            return NextResponse.json({ error: 'Missing bookingId or returnUrl' }, { status: 400 });
        }

        // 1. Fetch Booking Details Securely
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: booking, error } = await supabase
            .from('bookings')
            .select(`
                *,
                pilgrimage:pilgrimages (title)
            `)
            .eq('id', bookingId)
            .single();

        if (error || !booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // 2. Calculate Amount to Pay
        const amountLeft = booking.total_amount - (booking.paid_amount || 0);

        // Use provided amount (validated) or fallback to full remainder
        let amountToPay = amount ? Number(amount) : amountLeft;

        // Security check: Don't allow paying more than left (plus small buffer for float issues)
        if (amountToPay > amountLeft + 1) {
            amountToPay = amountLeft;
        }

        if (amountToPay <= 0) {
            return NextResponse.json({ error: 'Booking already paid' }, { status: 400 });
        }

        // 3. Create Stripe Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Inscrição: ${booking.pilgrimage.title}`,
                            description: `Pagamento da reserva #${booking.id.slice(0, 8)}`,
                        },
                        unit_amount: Math.round(amountToPay * 100), // Cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}?canceled=true`,
            metadata: {
                booking_id: booking.id,
                userId: booking.user_id,
                type: 'pilgrimage_payment',
                payment_type: 'custom' // Or regular remainder
            },
        });

        return NextResponse.json({ url: session.url });

    } catch (err: any) {
        console.error('Stripe Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
