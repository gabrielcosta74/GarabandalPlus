import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  buildBookingAccessUrl,
  generateBookingAutoLoginLink,
} from '../lib/booking-email-access';

describe('booking email access links', () => {
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

  it('generates a one-time login link that returns to the exact booking page', async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://project.supabase.co/auth/v1/verify?token=unused',
          hashed_token: 'one-time-hash',
        },
      },
      error: null,
    });
    const supabase = {
      auth: { admin: { generateLink } },
    } as unknown as SupabaseClient;
    const bookingUrl = buildBookingAccessUrl(
      'https://apostoladodegarabandal.com',
      'booking-1',
      'secure-token',
      'en',
    );

    const result = await generateBookingAutoLoginLink({
      supabase,
      email: ' Pilgrim@Example.com ',
      bookingUrl,
      appUrl: 'https://apostoladodegarabandal.com',
      locale: 'en',
    });

    const confirmationUrl = new URL(result!);
    expect(confirmationUrl.origin).toBe('https://apostoladodegarabandal.com');
    expect(confirmationUrl.pathname).toBe('/auth/confirm');
    expect(confirmationUrl.searchParams.get('token_hash')).toBe('one-time-hash');
    expect(confirmationUrl.searchParams.get('type')).toBe('magiclink');
    expect(confirmationUrl.searchParams.get('locale')).toBe('en');
    expect(confirmationUrl.searchParams.get('next')).toBe(
      '/en/pilgrimages/registration/booking-1',
    );
    expect(generateLink).toHaveBeenCalledOnce();
    const request = generateLink.mock.calls[0][0];
    expect(request.type).toBe('magiclink');
    expect(request.email).toBe('pilgrim@example.com');
    expect(request.options).toBeUndefined();
  });

  it('refuses an external booking redirect', async () => {
    const generateLink = vi.fn();
    const supabase = {
      auth: { admin: { generateLink } },
    } as unknown as SupabaseClient;

    const result = await generateBookingAutoLoginLink({
      supabase,
      email: 'pilgrim@example.com',
      bookingUrl: 'https://attacker.example/steal-session',
      appUrl: 'https://apostoladodegarabandal.com',
    });

    expect(result).toBeNull();
    expect(generateLink).not.toHaveBeenCalled();
  });
});
