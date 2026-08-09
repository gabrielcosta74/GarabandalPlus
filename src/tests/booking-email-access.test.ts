import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBookingAccessUrl,
  generateBookingAutoLoginLink,
} from '../lib/booking-email-access';
import {
  createBookingAutoLoginToken,
  verifyBookingAutoLoginToken,
} from '../lib/booking-auto-login-token';

describe('booking email access links', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'booking-email-test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds localized permanent booking links without losing the view token', () => {
    const ptUrl = new URL(buildBookingAccessUrl(
      'https://apostoladodegarabandal.com/',
      'booking-1',
      'token with symbols/+',
      'pt',
    ));
    const enUrl = new URL(buildBookingAccessUrl(
      'https://apostoladodegarabandal.com',
      'booking-1',
      'secure-token',
      'en',
    ));

    expect(ptUrl.pathname).toBe('/peregrinacoes/inscricao/booking-1');
    expect(ptUrl.searchParams.get('viewToken')).toBe('token with symbols/+');
    expect(ptUrl.searchParams.get('token')).toBe('token with symbols/+');
    expect(enUrl.pathname).toBe('/en/pilgrimages/registration/booking-1');
  });

  it('generates a reusable first-party link for just-in-time login', async () => {
    const bookingUrl = buildBookingAccessUrl(
      'https://apostoladodegarabandal.com',
      '11111111-1111-4111-8111-111111111111',
      'secure-token',
      'en',
    );

    const result = await generateBookingAutoLoginLink({
      bookingUrl,
      appUrl: 'https://apostoladodegarabandal.com',
      locale: 'en',
    });

    const confirmationUrl = new URL(result!);
    expect(confirmationUrl.origin).toBe('https://apostoladodegarabandal.com');
    expect(confirmationUrl.pathname).toBe('/api/booking/auto-login');
    expect(confirmationUrl.searchParams.get('booking')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(confirmationUrl.searchParams.get('locale')).toBe('en');
    expect(confirmationUrl.searchParams.get('signature')).toBeTruthy();
  });

  it('refuses an external booking redirect', async () => {
    const result = await generateBookingAutoLoginLink({
      bookingUrl: 'https://attacker.example/steal-session',
      appUrl: 'https://apostoladodegarabandal.com',
    });

    expect(result).toBeNull();
  });

  it('rejects expired or tampered stable login tokens', () => {
    const token = createBookingAutoLoginToken({
      bookingId: '11111111-1111-4111-8111-111111111111',
      locale: 'en',
      now: 1_000,
      ttlMs: 5_000,
    });

    expect(token).not.toBeNull();
    expect(verifyBookingAutoLoginToken({ ...token!, now: 2_000 })).toBe(true);
    expect(verifyBookingAutoLoginToken({ ...token!, locale: 'pt', now: 2_000 })).toBe(false);
    expect(verifyBookingAutoLoginToken({ ...token!, now: 6_001 })).toBe(false);
  });
});
