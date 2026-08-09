import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { sendBookingAccessLinkEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';
import {
  buildBookingAccessUrl,
  generateBookingAutoLoginLink,
} from '../../../../lib/booking-email-access';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'booking-send-access-link',
      windowMs: 60_000,
      max: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const host = req.headers.get('host') || '';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const isDev = process.env.NODE_ENV === 'development';
    const isInternalRequest = !!host && (origin.includes(host) || referer.includes(host));

    if (!isDev && !isInternalRequest) {
      return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ success: false, message: 'Configuração inválida.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const pilgrimageId = typeof body?.pilgrimageId === 'string' ? body.pilgrimageId : '';
    const requestedLocale: 'pt' | 'en' = body?.locale === 'en' ? 'en' : 'pt';

    if (!email || !pilgrimageId || !UUID_REGEX.test(pilgrimageId)) {
      return NextResponse.json({ success: false, message: 'Dados inválidos.' }, { status: 400 });
    }

    const { data: pilgrims, error: pilgrimsError } = await supabaseServer
      .from('pilgrims')
      .select('booking_id')
      .eq('email', email);

    if (pilgrimsError) {
      console.error('[API] send-access-link pilgrims error:', pilgrimsError);
      return NextResponse.json({ success: false, message: 'Erro a localizar reserva.' }, { status: 500 });
    }

    const bookingIds = Array.from(
      new Set(
        (pilgrims || [])
          .map((p: any) => p.booking_id)
          .filter((id: any) => typeof id === 'string' && UUID_REGEX.test(id)),
      ),
    );
    if (bookingIds.length === 0) {
      return NextResponse.json({ success: false, message: 'Reserva não encontrada.' }, { status: 404 });
    }

    const { data: bookings, error: bookingsError } = await supabaseServer
      .from('bookings')
      .select('id, user_id, view_token, pilgrimage_id, status, notes, created_at, pilgrimage:pilgrimages(title, title_en)')
      .in('id', bookingIds)
      .eq('pilgrimage_id', pilgrimageId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1);

    if (bookingsError) {
      console.error('[API] send-access-link bookings error:', bookingsError);
      return NextResponse.json({ success: false, message: 'Erro a localizar reserva.' }, { status: 500 });
    }

    const booking = bookings?.[0];
    if (!booking?.id) {
      return NextResponse.json({ success: false, message: 'Reserva não encontrada.' }, { status: 404 });
    }

    const appUrl = getAppUrl();
    const locale: 'pt' | 'en' = /\[locale:en\]/i.test(String(booking.notes || ''))
      ? 'en'
      : requestedLocale;
    const directAccessLink = buildBookingAccessUrl(
      appUrl,
      booking.id,
      booking.view_token,
      locale,
    );

    // Only authenticate the account when this email is the actual Auth owner.
    // A secondary pilgrim can still receive the booking-scoped fallback link,
    // but must never be logged in as the booking owner.
    const { data: authUserData } = booking.user_id
      ? await supabaseServer.auth.admin.getUserById(booking.user_id)
      : { data: { user: null } };
    const authEmail = normalizeEmail(authUserData?.user?.email);
    const isAuthOwner = authEmail === email;

    // Legacy bookings may not have a view token. They can only be opened via a
    // real Auth session belonging to the account owner; never broaden access to
    // a secondary pilgrim in that case.
    if (!booking.view_token && !isAuthOwner) {
      return NextResponse.json({ success: false, message: 'Reserva não encontrada.' }, { status: 404 });
    }

    const autoLoginLink = isAuthOwner
      ? await generateBookingAutoLoginLink({
          bookingUrl: directAccessLink,
          appUrl,
          locale,
        })
      : null;

    if (!autoLoginLink && !booking.view_token) {
      return NextResponse.json({
        success: false,
        message: 'Não foi possível gerar um acesso seguro. Tente novamente.',
      }, { status: 503 });
    }

    const pilgrimage = booking.pilgrimage as unknown as {
      title?: unknown;
      title_en?: unknown;
    } | null;
    const pilgrimageName = locale === 'en' && typeof pilgrimage?.title_en === 'string'
      ? pilgrimage.title_en
      : typeof pilgrimage?.title === 'string'
        ? pilgrimage.title
        : null;

    const sent = await sendBookingAccessLinkEmail({
      email,
      accessLink: autoLoginLink || directAccessLink,
      directAccessLink: booking.view_token ? directAccessLink : null,
      pilgrimageName,
      locale,
    });
    if (!sent) {
      return NextResponse.json({ success: false, message: 'Serviço de email indisponível.' }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] send-access-link error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar link.' }, { status: 500 });
  }
}
