import { createBookingAutoLoginToken } from './booking-auto-login-token';

export type BookingEmailLocale = 'pt' | 'en';

type GenerateBookingAutoLoginLinkInput = {
  bookingUrl: string;
  appUrl: string;
  locale?: BookingEmailLocale;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export const buildBookingAccessUrl = (
  appUrl: string,
  bookingId: string,
  viewToken?: string | null,
  locale: BookingEmailLocale = 'pt',
) => {
  const path = locale === 'en'
    ? `/en/pilgrimages/registration/${encodeURIComponent(bookingId)}`
    : `/peregrinacoes/inscricao/${encodeURIComponent(bookingId)}`;
  const url = new URL(path, `${normalizeBaseUrl(appUrl)}/`);
  const token = String(viewToken || '').trim();

  if (token) {
    // Keep both parameters for compatibility with old Reduniq return URLs.
    url.searchParams.set('viewToken', token);
    url.searchParams.set('token', token);
  }

  return url.toString();
};

/**
 * Generates a reusable, signed first-party link. Each visit creates a fresh
 * one-time Supabase token, so email security scanners cannot consume the
 * recipient's login before they open the message.
 *
 * The permanent booking URL remains separate and must always be included in the
 * email as a fallback. A failure here must never prevent a payment email.
 */
export const generateBookingAutoLoginLink = async ({
  bookingUrl,
  appUrl,
  locale = 'pt',
}: GenerateBookingAutoLoginLinkInput): Promise<string | null> => {
  try {
    const normalizedAppUrl = normalizeBaseUrl(appUrl);
    const appOrigin = new URL(`${normalizedAppUrl}/`).origin;
    const parsedBookingUrl = new URL(bookingUrl);

    // Never let an email-controlled or external URL become an auth redirect.
    if (parsedBookingUrl.origin !== appOrigin) return null;

    const bookingId = parsedBookingUrl.pathname.split('/').filter(Boolean).at(-1);
    if (!bookingId) return null;

    const token = createBookingAutoLoginToken({ bookingId, locale });
    if (!token) return null;

    const accessUrl = new URL('/api/booking/auto-login', `${normalizedAppUrl}/`);
    accessUrl.searchParams.set('booking', token.bookingId);
    accessUrl.searchParams.set('expires', String(token.expiresAt));
    accessUrl.searchParams.set('locale', token.locale);
    accessUrl.searchParams.set('signature', token.signature);
    return accessUrl.toString();
  } catch (error) {
    console.warn(
      '[Booking Email Access] Failed to prepare auto-login link:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return null;
  }
};
