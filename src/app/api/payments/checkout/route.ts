import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/config';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { inferRequestLocale } from '../../../../lib/locale-routing';
import {
    buildPilgrimageReduniqFeeNote,
    calculatePilgrimageReduniqCharge,
} from '../../../../lib/pilgrimage-reduniq-fees';

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
        const locale = inferRequestLocale(req);
        // Return path must map to the REAL route for each locale. The EN slug is
        // `/en/pilgrimages/registration`; the PT route is `/peregrinacoes/inscricao`
        // (not a locale-prefixed copy of the EN slug). Using withLocalePrefix here
        // produced `/pilgrimages/registration/{id}` for PT, which is a 404.
        const bookingPathBase = locale === 'en'
            ? '/en/pilgrimages/registration'
            : '/peregrinacoes/inscricao';
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

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            console.error("Supabase credentials missing");
            return NextResponse.json({ error: "Erro interno de configuração" }, { status: 500 });
        }

        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            }
        });

        const body = await req.json();
        const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : null;
        const priceType = body?.priceType === 'deposit' ? 'deposit' : 'full';
        const provider = body?.provider === 'reduniq' ? 'reduniq' : null;
        const dryRun = body?.dryRun === true;
        const requestedAmountRaw = Number(body?.amountToPay);
        const requestedAmount = Number.isFinite(requestedAmountRaw) && requestedAmountRaw > 0
            ? Math.round(requestedAmountRaw * 100) / 100
            : null;

        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId em falta.' }, { status: 400 });
        }

        if (!provider) {
            return NextResponse.json(
                { error: 'Nas peregrinações, os pagamentos online estão disponíveis apenas via Reduniq.' },
                { status: 400 },
            );
        }

        // 1. Fetch Booking Details
        const { data: booking, error: bookingError } = await supabaseAdmin
            .from('bookings')
            .select(`
                *,
                pilgrimage:pilgrimages(title, deposit_value),
                payments:pilgrimage_payments(amount, status)
            `)
            .eq('id', bookingId)
            .single();

        console.log("DEBUG bookingError:", bookingError);
        if (bookingError) {
            require('fs').writeFileSync('/tmp/booking-error.txt', JSON.stringify(bookingError));
        }

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
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
        const proto = req.headers.get('x-forwarded-proto') || 'https';
        const requestOrigin = req.headers.get('origin') || (host ? `${proto}://${host}` : '');
        const appOrigin = getAppUrl();
        const originCandidates = Array.from(
            new Set(
                [requestOrigin, appOrigin]
                    .map((value) => String(value || '').trim().replace(/\/$/, ''))
                    .filter(Boolean),
            ),
        );
        const fallbackOrigin = originCandidates[0] || 'http://localhost:3000';
        const nowIso = new Date().toISOString();
        const bookingPrefix = String(booking.id || '').slice(0, 8);
        const isLocalHost = fallbackOrigin.includes('localhost') || fallbackOrigin.includes('127.0.0.1');
        const allowDryRun = dryRun && (process.env.NODE_ENV !== 'production' || isLocalHost);

        // Online pilgrimage checkout uses the general Reduniq terminal only.
        const orderRef = `pil${bookingPrefix}${Date.now().toString().slice(-8)}`;
        const safeDescription = `Peregrinacao ${bookingPrefix}`;
        const charge = calculatePilgrimageReduniqCharge(safeAmountToPay);
        const chargedAmount = charge.chargedAmount;
        const feeNote = buildPilgrimageReduniqFeeNote(safeAmountToPay);

        if (allowDryRun) {
            return NextResponse.json({
                dryRun: true,
                provider: 'reduniq',
                terminalMode: 'general',
                bookingId: booking.id,
                priceType,
                lineItemTitle,
                baseAmount: safeAmountToPay,
                feeAmount: charge.feeAmount,
                chargedAmount,
                totalRemaining,
                orderRefPreview: orderRef,
                notesPreview: `${feeNote} | Tipo: ${priceType}`,
            });
        }

        let initResult: any = null;
        let selectedOrigin = fallbackOrigin;

        for (const candidateOrigin of originCandidates.length ? originCandidates : [fallbackOrigin]) {
            const successUrl = `${candidateOrigin}${bookingPathBase}/${booking.id}?provider=reduniq&orderRef=${orderRef}&status=success`;
            const cancelUrl = `${candidateOrigin}${bookingPathBase}/${booking.id}?provider=reduniq&orderRef=${orderRef}&status=failed&canceled=true`;
            const notificationUrl = `${candidateOrigin}/api/webhooks/reduniq`;

            const attemptInit = async (action: 100 | 101 = 101) => reduniqClient.initiatePayment({
                amount: chargedAmount,
                orderRef,
                returnUrlOk: successUrl,
                returnUrlError: cancelUrl,
                notificationUrl,
                description: safeDescription,
                languageCode: locale === 'en' ? 'eng' : 'por',
                action,
            });

            initResult = await attemptInit(101);
            if (initResult?.success && initResult?.url) {
                selectedOrigin = candidateOrigin;
                break;
            }

            initResult = await attemptInit(100);
            if (initResult?.success && initResult?.url) {
                selectedOrigin = candidateOrigin;
                break;
            }
        }

        if (!initResult?.success || !initResult?.url) {
            console.error('[Reduniq][Pilgrimage] Init failed', {
                error: initResult?.error,
                resultCode: initResult?.resultCode,
                raw: initResult?.raw,
                bookingId: booking.id,
                orderRef,
                baseAmount: safeAmountToPay,
                chargedAmount,
                originCandidates,
            });
            return NextResponse.json(
                { error: toSafeCheckoutError(initResult?.error || 'Falha ao iniciar pagamento Reduniq.') },
                { status: 502 },
            );
        }

        try {
            await supabaseAdmin.from('pilgrimage_payments').insert({
                booking_id: booking.id,
                user_id: booking.user_id,
                amount: safeAmountToPay,
                method: 'reduniq',
                status: 'pending',
                payment_intent_id: initResult.token || initResult.transactionId || orderRef,
                external_reference: orderRef,
                created_at: nowIso,
                notes: `${feeNote} | Tipo: ${priceType}`,
            });
        } catch (dbErr) {
            console.warn('Não foi possível criar registo preliminar de peregrinação (Reduniq):', dbErr);
        }

        const normalizedGatewayUrl = normalizeRedirectUrl(initResult.url, selectedOrigin);
        return NextResponse.json({ url: normalizedGatewayUrl, orderRef });

    } catch (error: any) {
        console.error("Checkout Error:", error);
        return NextResponse.json({ error: toSafeCheckoutError(error) }, { status: 500 });
    }
}
