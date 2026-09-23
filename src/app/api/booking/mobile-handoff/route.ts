import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildBookingAccessUrl } from '../../../../lib/booking-email-access';
import { getAppUrl } from '../../../../lib/config';
import { normalizeEmail } from '../../../../lib/normalize';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function redirect(url: string) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  const recovery = () => redirect(new URL('/login?error=invalid-link', `${appUrl}/`).toString());
  if (process.env.MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED !== 'true' || !supabaseServer) return recovery();
  const rateLimit = checkRateLimit(request, { keyPrefix: 'mobile-booking-handoff', windowMs: 60_000, max: 30 });
  if (!rateLimit.allowed) return recovery();

  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!TOKEN_PATTERN.test(token)) return recovery();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString();
  // A conditional UPDATE ... RETURNING consumes the token atomically, even
  // when two requests arrive together. No bearer credential enters the URL.
  const { data: handoff, error } = await supabaseServer
    .from('mobile_booking_web_handoffs')
    .update({ consumed_at: now })
    .eq('token_hash', tokenHash)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('booking_id,pilgrimage_slug,user_id,locale')
    .maybeSingle();
  if (error || !handoff) return recovery();

  const locale = handoff.locale === 'en' ? 'en' : 'pt';
  let destinationPath: string;
  if (handoff.booking_id) {
    const { data: booking, error: bookingError } = await supabaseServer
      .from('bookings')
      .select('id,user_id,status')
      .eq('id', handoff.booking_id)
      .eq('user_id', handoff.user_id)
      .maybeSingle();
    if (bookingError || !booking || booking.status === 'canceled') return recovery();
    destinationPath = new URL(buildBookingAccessUrl(appUrl, booking.id, null, locale)).pathname;
  } else if (handoff.pilgrimage_slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(handoff.pilgrimage_slug)) {
    destinationPath = locale === 'en'
      ? `/en/pilgrimages/${encodeURIComponent(handoff.pilgrimage_slug)}/register`
      : `/peregrinacoes/${encodeURIComponent(handoff.pilgrimage_slug)}/inscrever`;
  } else {
    return recovery();
  }

  const loginRecovery = () => {
    const url = new URL(locale === 'en' ? '/en/login' : '/login', `${appUrl}/`);
    url.searchParams.set('error', 'auth-config');
    url.searchParams.set('next', destinationPath);
    return redirect(url.toString());
  };

  const { data: userData, error: userError } = await supabaseServer.auth.admin.getUserById(handoff.user_id);
  const email = normalizeEmail(userData?.user?.email);
  if (userError || !email) return loginRecovery();
  const { data: linkData, error: linkError } = await supabaseServer.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHashForAuth = linkData?.properties?.hashed_token;
  if (linkError || !tokenHashForAuth) return loginRecovery();

  const confirmationUrl = new URL('/auth/confirm', `${appUrl}/`);
  confirmationUrl.searchParams.set('token_hash', tokenHashForAuth);
  confirmationUrl.searchParams.set('type', 'magiclink');
  confirmationUrl.searchParams.set('next', destinationPath);
  if (locale === 'en') confirmationUrl.searchParams.set('locale', 'en');
  return redirect(confirmationUrl.toString());
}
