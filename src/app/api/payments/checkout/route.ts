import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseServer } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/config';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { checkRateLimit } from '../../../../lib/rate-limit';

const normalizeRedirectUrl = (candidate: string, baseOrigin: string): string => {
    const raw = String(candidate || '').trim();
    if (!raw) throw new Error('URL de pagamento vazia.');

    let parsed: URL | null = null;
    try {
        parsed = new URL(raw);
    } catch {
        try {
            parsed = new URL(raw, baseOrigin);
        } catch {
            throw new Error('URL de pagamento inválida.');
        }
    }

    if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
        throw new Error('URL de pagamento inválida.');
    }

    return parsed.toString();
};

const toSafeCheckoutError = (error: unknown): string => {
    const raw = (error as any)?.message ? String((error as any).message) : 'Erro ao iniciar pagamento.';
    if (raw.toLowerCase().includes('expected pattern')) {
        return 'Configuração de pagamento inválida. Contacte o suporte.';
    }
    return raw;
};

export async function POST(req: Request) {
    try {
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'payments-checkout',
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

        if (!supabaseServer) {
            console.error("Supabase Server Client missing");
            return NextResponse.json({ error: "Erro interno de configuração" }, { status: 500 });
        }

        const body = await req.json();
        const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : null;
        const priceType = body?.priceType === 'deposit' ? 'deposit' : 'full';
        const provider = body?.provider === 'reduniq' ? 'reduniq' : 'stripe';
        const reduniqSolution = Number.isInteger(body?.reduniqSolution) ? Number(body.reduniqSolution) : undefined;
        const requestedAmountRaw = Number(body?.amountToPay);
        const requestedAmount = Number.isFinite(requestedAmountRaw) && requestedAmountRaw > 0
            ? Math.round(requestedAmountRaw * 100) / 100
            : null;

        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId em falta.' }, { status: 400 });
        }

        // 1. Fetch Booking Details
        const { data: booking, error: bookingError } = await supabaseServer
            .from('bookings')
            .select(`
                *,
                pilgrimage:pilgrimages(title, deposit_value),
                payments:pilgrimage_payments(amount, status)
            `)
            .eq('id', bookingId)
            .single();

        if (bookingError || !booking) {
            return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
        }

        // 2. Determine Amount
        let amountToPay = 0;
        let lineItemTitle = `Pagamento - ${booking.pilgrimage.title}`;

        const total = Number(booking.total_amount) || 0;
        const successfulStatuses = ['verified', 'succeeded', 'paid', 'manual'];
        const successfulPaidFromPayments = (booking.payments || [])
            .filter((p: any) => successfulStatuses.includes(String(p?.status || '').toLowerCase()))
            .reduce((sum: number, p: any) => sum + (Number(p?.amount) || 0), 0);
        const paid = Math.max(Number(booking.paid_amount) || 0, successfulPaidFromPayments);
        const deposit = booking.pilgrimage.deposit_value;

        if (priceType === 'deposit') {
            amountToPay = deposit - paid; // Pay remaining deposit
            lineItemTitle = `Sinal - ${booking.pilgrimage.title}`;
        } else {
            // Full Payment
            amountToPay = total - paid;
            lineItemTitle = `Pagamento Total - ${booking.pilgrimage.title}`;
        }

        const totalRemaining = Math.max(0, Math.round((total - paid) * 100) / 100);

        if (requestedAmount !== null) {
            if (requestedAmount > totalRemaining + 0.009) {
                return NextResponse.json({ error: "Valor inválido para pagamento." }, { status: 400 });
            }
            amountToPay = requestedAmount;
            lineItemTitle = `Pagamento - ${booking.pilgrimage.title}`;
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
            const viewToken = typeof booking.view_token === 'string' ? booking.view_token : null;
            const viewTokenQuery = viewToken ? `&viewToken=${encodeURIComponent(viewToken)}` : '';
            const successUrl = `${origin}/peregrinacoes/inscricao/${booking.id}?provider=reduniq&orderRef=${orderRef}&status=success${viewTokenQuery}`;
            const cancelUrl = `${origin}/peregrinacoes/inscricao/${booking.id}?provider=reduniq&orderRef=${orderRef}&status=failed&canceled=true${viewTokenQuery}`;

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
                return NextResponse.json({ error: toSafeCheckoutError(initResult.error || 'Falha ao iniciar pagamento Reduniq.') }, { status: 502 });
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

            const normalizedGatewayUrl = normalizeRedirectUrl(initResult.url, origin);
            return NextResponse.json({ url: normalizedGatewayUrl, orderRef });
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

        if (!session.url) {
            return NextResponse.json({ error: 'URL de pagamento Stripe inválida.' }, { status: 502 });
        }

        const normalizedStripeUrl = normalizeRedirectUrl(session.url, origin);
        return NextResponse.json({ url: normalizedStripeUrl });

    } catch (error: any) {
        console.error("Checkout Error:", error);
        return NextResponse.json({ error: toSafeCheckoutError(error) }, { status: 500 });
    }
}
