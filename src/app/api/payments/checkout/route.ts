import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseServer } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/config';

export async function POST(req: Request) {
    try {
        if (!supabaseServer) {
            console.error("Supabase Server Client missing");
            return NextResponse.json({ error: "Erro interno de configuração" }, { status: 500 });
        }

        const { bookingId, priceType } = await req.json();

        // 1. Fetch Booking Details
        const { data: booking, error: bookingError } = await supabaseServer
            .from('bookings')
            .select('*, pilgrimage:pilgrimages(title, deposit_value)')
            .eq('id', bookingId)
            .single();

        if (bookingError || !booking) {
            return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
        }

        // 2. Determine Amount
        let amountToPay = 0;
        let lineItemTitle = `Pagamento - ${booking.pilgrimage.title}`;

        const total = booking.total_amount;
        const paid = booking.paid_amount;
        const deposit = booking.pilgrimage.deposit_value;

        if (priceType === 'deposit') {
            amountToPay = deposit - paid; // Pay remaining deposit
            lineItemTitle = `Sinal - ${booking.pilgrimage.title}`;
        } else {
            // Full Payment
            amountToPay = total - paid;
            lineItemTitle = `Pagamento Total - ${booking.pilgrimage.title}`;
        }

        if (amountToPay <= 0) {
            return NextResponse.json({ error: "Valor já liquidado." }, { status: 400 });
        }

        // 3. Create Stripe Session
        const origin = req.headers.get('origin') || getAppUrl();

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'multibanco'], // Add 'multibanco' if stripe account supports it
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: lineItemTitle,
                            description: `Reserva #${booking.id.slice(0, 8)}`,
                            images: ['https://apostoladodegarabandal.com/images/nossasenhoragarabandal.jpg'], // Optional
                        },
                        unit_amount: Math.round(amountToPay * 100), // Cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/peregrinacoes/inscricao/${booking.id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/peregrinacoes/inscricao/${booking.id}?canceled=true`,
            metadata: {
                booking_id: booking.id,
                type: 'pilgrimage_payment',
                payment_type: priceType // 'deposit' or 'full'
            },
            customer_email: undefined // We could pass email if we knew it for sure, but user might want to use another
        });

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error("Stripe Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
