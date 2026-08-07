import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingEmailLocale = 'pt' | 'en';

type GenerateBookingAutoLoginLinkInput = {
  supabase: SupabaseClient;
  email: string;
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
 * Generates a short-lived, one-time Supabase magic link that authenticates the
 * recipient and then returns them to the authenticated booking page.
 *
 * The permanent booking URL remains separate and must always be included in the
 * email as a fallback. A failure here must never prevent a payment email.
 */
export const generateBookingAutoLoginLink = async ({
  supabase,
  email,
  bookingUrl,
  appUrl,
  locale = 'pt',
}: GenerateBookingAutoLoginLinkInput): Promise<string | null> => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    const normalizedAppUrl = normalizeBaseUrl(appUrl);
    const appOrigin = new URL(`${normalizedAppUrl}/`).origin;
    const parsedBookingUrl = new URL(bookingUrl);

    // Never let an email-controlled or external URL become an auth redirect.
    if (parsedBookingUrl.origin !== appOrigin) return null;

    // The authenticated destination does not need the permanent booking token.
    // Keep that secret only in the explicit fallback link, out of Auth URLs and
    // the post-login browser history.
    parsedBookingUrl.searchParams.delete('viewToken');
    parsedBookingUrl.searchParams.delete('token');
    const nextPath = `${parsedBookingUrl.pathname}${parsedBookingUrl.search}`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    if (error) {
      console.warn('[Booking Email Access] Auto-login link unavailable:', error.code || error.message);
      return null;
    }

    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) return null;

    // Use the first-party server verifier instead of the generated action_link.
    // This avoids implicit-flow URL fragments and guarantees that Auth cookies
    // are established before redirecting to the payment page.
    const confirmationUrl = new URL('/auth/confirm', `${normalizedAppUrl}/`);
    confirmationUrl.searchParams.set('token_hash', tokenHash);
    confirmationUrl.searchParams.set('type', 'magiclink');
    confirmationUrl.searchParams.set('next', nextPath);
    if (locale === 'en') confirmationUrl.searchParams.set('locale', 'en');

    return confirmationUrl.toString();
  } catch (error) {
    console.warn(
      '[Booking Email Access] Failed to prepare auto-login link:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return null;
  }
};
