import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { sendBookingAccessLinkEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';

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
      .select('id, view_token, pilgrimage_id, status, created_at, pilgrimage:pilgrimages(title)')
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
    if (!booking?.id || !booking?.view_token) {
      return NextResponse.json({ success: false, message: 'Reserva não encontrada.' }, { status: 404 });
    }

    const encoded = encodeURIComponent(booking.view_token);
    const appUrl = getAppUrl();
    const accessLink = `${appUrl}/peregrinacoes/inscricao/${booking.id}?viewToken=${encoded}&token=${encoded}`;

    const pilgrimageName =
      typeof (booking as any)?.pilgrimage?.title === 'string'
        ? (booking as any).pilgrimage.title
        : null;

    const sent = await sendBookingAccessLinkEmail({ email, accessLink, pilgrimageName });
    if (!sent) {
      return NextResponse.json({ success: false, message: 'Serviço de email indisponível.' }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] send-access-link error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar link.' }, { status: 500 });
  }
}
