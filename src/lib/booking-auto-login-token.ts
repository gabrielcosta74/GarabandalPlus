import { createHmac, timingSafeEqual } from 'node:crypto';

export type BookingAutoLoginLocale = 'pt' | 'en';

type BookingAutoLoginTokenInput = {
  bookingId: string;
  locale: BookingAutoLoginLocale;
  expiresAt: number;
};

const PURPOSE = 'booking-auto-login';
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const getSecret = () =>
  process.env.BOOKING_AUTO_LOGIN_SECRET?.trim()
  || process.env.CRON_SECRET?.trim()
  || null;

const payloadFor = ({ bookingId, locale, expiresAt }: BookingAutoLoginTokenInput) =>
  `${PURPOSE}:${bookingId}:${locale}:${expiresAt}`;

const sign = (input: BookingAutoLoginTokenInput, secret: string) =>
  createHmac('sha256', secret).update(payloadFor(input)).digest('base64url');

export const createBookingAutoLoginToken = ({
  bookingId,
  locale,
  now = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
}: {
  bookingId: string;
  locale: BookingAutoLoginLocale;
  now?: number;
  ttlMs?: number;
}) => {
  const secret = getSecret();
  if (!secret) return null;

  const expiresAt = now + ttlMs;
  return {
    bookingId,
    locale,
    expiresAt,
    signature: sign({ bookingId, locale, expiresAt }, secret),
  };
};

export const verifyBookingAutoLoginToken = ({
  bookingId,
  locale,
  expiresAt,
  signature,
  now = Date.now(),
}: BookingAutoLoginTokenInput & {
  signature: string;
  now?: number;
}) => {
  const secret = getSecret();
  if (!secret || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = sign({ bookingId, locale, expiresAt }, secret);
  const actualBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
};
