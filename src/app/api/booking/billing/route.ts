import { NextResponse } from 'next/server';

import { requireAuth } from '../../../../lib/auth-utils';
import { fiscalBillingErrorMessage, type FiscalBillingField } from '../../../../lib/fiscal-billing';
import { savePilgrimageBillingProfile } from '../../../../lib/pilgrimage-billing';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { supabaseServer } from '../../../../lib/supabase';

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }

    const rateLimit = checkRateLimit(req, {
        keyPrefix: 'booking-billing',
        windowMs: 60_000,
        max: 20,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
        );
    }

    const body = await req.json();
    const { bookingId, token, billing, locale } = body || {};
    const isEnglish = locale === 'en';

    if (!bookingId || !billing || typeof billing !== 'object') {
        return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseServer
        .from('bookings')
        .select(`
            id,
            user_id,
            view_token,
            pilgrims(id, full_name, email, address, postal_code, city, country, cpf_nif, created_at)
        `)
        .eq('id', bookingId)
        .single();

    if (bookingError || !booking) {
        return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
    }

    if (token) {
        if (booking.view_token !== token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    } else {
        const { user } = await requireAuth();
        if (booking.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    try {
        const saved = await savePilgrimageBillingProfile(supabaseServer, booking, billing);
        return NextResponse.json({ billing: saved });
    } catch (error) {
        const fields = (error as Error & { fields?: FiscalBillingField[] }).fields;
        if (fields?.length) {
            return NextResponse.json(
                { error: fiscalBillingErrorMessage(fields, isEnglish, billing.country), fields },
                { status: 400 },
            );
        }
        return NextResponse.json(
            { error: (error as Error).message || 'Não foi possível guardar os dados de faturação.' },
            { status: 500 },
        );
    }
}
