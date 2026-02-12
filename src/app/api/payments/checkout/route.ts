import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseServer } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/config';
import { reduniqClient } from '../../../../lib/reduniq/client';

export async function POST(req: Request) {
    try {
        if (!supabaseServer) {
            console.error("Supabase Server Client missing");
            return NextResponse.json({ error: "Erro interno de configuração" }, { status: 500 });
        }

        const body = await req.json();
        const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : null;
        const priceType = body?.priceType === 'deposit' ? 'deposit' : 'full';
        const provider = body?.provider === 'reduniq' ? 'reduniq' : 'stripe';
        const reduniqSolution = Number.isInteger(body?.reduniqSolution) ? Number(body.reduniqSolution) : undefined;

        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId em falta.' }, { status: 400 });
        }

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

        const safeAmountToPay = Math.round(amountToPay * 100) / 100;
        const origin = req.headers.get('origin') || getAppUrl();
        const nowIso = new Date().toISOString();
        const bookingPrefix = String(booking.id || '').slice(0, 8);

        // 3A. Reduniq Checkout
        if (provider === 'reduniq') {
            const orderRef = `pilgrimage_${bookingPrefix}_${Date.now()}`;
            const successUrl = `${origin}/peregrinacoes/inscricao/${booking.id}?provider=reduniq&orderRef=${orderRef}&status=success`;
            const cancelUrl = `${origin}/peregrinacoes/inscricao/${booking.id}?provider=reduniq&orderRef=${orderRef}&status=failed&canceled=true`;

            const attemptInit = async (solution?: number) => reduniqClient.initiatePayment({
                amount: safeAmountToPay,
                orderRef,
                returnUrlOk: successUrl,
                returnUrlError: cancelUrl,
                notificationUrl: `${origin}/api/webhooks/reduniq`,
                description: `${lineItemTitle} - Reserva #${bookingPrefix}`,
                solution,
                languageCode: 'por',
                action: 101,
            });

            let initResult = await attemptInit(reduniqSolution);
            if (!initResult.success && reduniqSolution) {
                const msg = (initResult.error || '').toLowerCase();
                const code = (initResult.resultCode || '').toLowerCase();
                const looksLikeInvalidSolution =
                    msg.includes('invalid payment solution') ||
                    (msg.includes('invalid parameter') && msg.includes('payment.solution')) ||
                    code.startsWith('003');

                if (looksLikeInvalidSolution) {
                    console.warn(`[Reduniq][Pilgrimage] Solution ${reduniqSolution} rejeitada; fallback para terminal geral.`);
                    initResult = await attemptInit(undefined);
                }
            }

            if (!initResult.success || !initResult.url) {
                return NextResponse.json({ error: initResult.error || 'Falha ao iniciar pagamento Reduniq.' }, { status: 502 });
            }

            try {
                await supabaseServer.from('pilgrimage_payments').insert({
                    booking_id: booking.id,
                    user_id: booking.user_id,
                    amount: safeAmountToPay,
                    method: 'reduniq',
                    status: 'pending',
                    payment_intent_id: initResult.token || initResult.transactionId || orderRef,
                    external_reference: orderRef,
                    created_at: nowIso,
                    notes: `Pagamento via Reduniq (${priceType})`,
                });
            } catch (dbErr) {
                console.warn('Não foi possível criar registo preliminar de peregrinação (Reduniq):', dbErr);
            }

            return NextResponse.json({ url: initResult.url, orderRef });
        }

        // 3B. Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'multibanco'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: lineItemTitle,
                            description: `Reserva #${bookingPrefix}`,
                            images: ['https://apostoladodegarabandal.com/images/nossasenhoragarabandal.jpg'],
                        },
                        unit_amount: Math.round(safeAmountToPay * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/peregrinacoes/inscricao/${booking.id}?success=true&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/peregrinacoes/inscricao/${booking.id}?canceled=true&provider=stripe`,
            metadata: {
                booking_id: booking.id,
                userId: booking.user_id,
                type: 'pilgrimage_payment',
                payment_type: priceType,
                provider: 'stripe',
            },
            customer_email: undefined
        });

        try {
            await supabaseServer.from('pilgrimage_payments').insert({
                booking_id: booking.id,
                user_id: booking.user_id,
                amount: safeAmountToPay,
                method: 'stripe',
                status: 'pending',
                payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
                external_reference: session.id,
                created_at: nowIso,
                notes: `Checkout Stripe (${priceType})`,
            });
        } catch (dbErr) {
            console.warn('Não foi possível criar registo preliminar de peregrinação (Stripe):', dbErr);
        }

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error("Checkout Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
