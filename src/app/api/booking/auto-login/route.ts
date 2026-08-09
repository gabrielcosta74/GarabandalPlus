import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getAppUrl } from '../../../../lib/config';
import { buildBookingAccessUrl } from '../../../../lib/booking-email-access';
import { verifyBookingAutoLoginToken } from '../../../../lib/booking-auto-login-token';
import { normalizeEmail } from '../../../../lib/normalize';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const noStoreRedirect = (url: string) => {
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
};

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  const url = new URL(request.url);
  const bookingId = url.searchParams.get('booking') || '';
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'pt';
  const expiresAt = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature') || '';
  const loginPath = locale === 'en' ? '/en/login' : '/login';

  const rateLimit = checkRateLimit(request, {
    keyPrefix: 'booking-auto-login',
    windowMs: 60_000,
    max: 20,
  });

  if (
    !rateLimit.allowed
    || !UUID_REGEX.test(bookingId)
    || !verifyBookingAutoLoginToken({ bookingId, locale, expiresAt, signature })
  ) {
    return noStoreRedirect(`${appUrl}${loginPath}?error=invalid-link`);
  }

  if (!supabaseServer) {
    return noStoreRedirect(`${appUrl}${loginPath}?error=auth-config`);
  }

  const { data: booking, error: bookingError } = await supabaseServer
    .from('bookings')
    .select('id, user_id, view_token, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError || !booking || booking.status === 'cancelled') {
    return noStoreRedirect(`${appUrl}${loginPath}?error=invalid-link`);
  }

  const fallbackUrl = buildBookingAccessUrl(appUrl, booking.id, booking.view_token, locale);
  if (!booking.user_id) return noStoreRedirect(fallbackUrl);

  const { data: authUserData, error: authUserError } = await supabaseServer.auth.admin
    .getUserById(booking.user_id);
  const email = normalizeEmail(authUserData?.user?.email);

  if (authUserError || !email) return noStoreRedirect(fallbackUrl);

  const { data: linkData, error: linkError } = await supabaseServer.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.warn(
      '[Booking Auto Login] Fresh magic link unavailable:',
      linkError?.code || linkError?.message || 'missing token hash',
    );
    return noStoreRedirect(fallbackUrl);
  }

  const destination = buildBookingAccessUrl(appUrl, booking.id, null, locale);
  const confirmationUrl = new URL('/auth/confirm', `${appUrl}/`);
  confirmationUrl.searchParams.set('token_hash', tokenHash);
  confirmationUrl.searchParams.set('type', 'magiclink');
  confirmationUrl.searchParams.set('next', new URL(destination).pathname);
  if (locale === 'en') confirmationUrl.searchParams.set('locale', 'en');

  return noStoreRedirect(confirmationUrl.toString());
}
