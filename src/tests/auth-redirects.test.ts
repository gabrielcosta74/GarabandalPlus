import { describe, expect, it } from 'vitest';
import {
  buildAuthCallbackLoginUrl,
  buildDirectRecoveryUrl,
  buildRecoveryCodeEntryUrl,
  buildRecoveryFailurePath,
  buildRecoveryRedirectUrl,
  detectUpdatePasswordAuthPayload,
  hasAuthCallbackPayload,
  resolveAuthCallbackRedirect,
} from '../lib/auth-redirects';

describe('auth redirects', () => {
  it('prioritizes recovery over next/profile redirects', () => {
    expect(
      resolveAuthCallbackRedirect({
        type: 'recovery',
        next: '/account/profile',
        refCode: 'ABC123',
      })
    ).toBe('/auth/update-password');
  });

  it('builds a recovery redirect through auth-callback', () => {
    expect(buildRecoveryRedirectUrl('https://app.apostoladodegarabandal.com')).toBe(
      'https://app.apostoladodegarabandal.com/auth-callback?next=%2Fauth%2Fupdate-password&type=recovery&locale=pt'
    );
    expect(buildRecoveryRedirectUrl('https://app.apostoladodegarabandal.com/', 'en')).toBe(
      'https://app.apostoladodegarabandal.com/auth-callback?next=%2Fen%2Fauth%2Fupdate-password&type=recovery&locale=en'
    );
  });

  it('builds first-party recovery links for both direct and code flows', () => {
    expect(buildDirectRecoveryUrl(
      'https://apostoladodegarabandal.com/',
      'hashed-token',
    )).toBe(
      'https://apostoladodegarabandal.com/auth/update-password?token_hash=hashed-token&type=recovery'
    );
    expect(buildDirectRecoveryUrl(
      'https://apostoladodegarabandal.com',
      'hashed-token',
      'en',
    )).toBe(
      'https://apostoladodegarabandal.com/en/auth/update-password?token_hash=hashed-token&type=recovery'
    );
    expect(buildRecoveryCodeEntryUrl(
      'https://apostoladodegarabandal.com',
      'en',
    )).toBe(
      'https://apostoladodegarabandal.com/en/auth/update-password?mode=code'
    );
  });

  it('returns expired recovery links to a helpful localized screen', () => {
    expect(buildRecoveryFailurePath('pt')).toBe('/auth/update-password?status=invalid-link');
    expect(buildRecoveryFailurePath('en')).toBe('/en/auth/update-password?status=invalid-link');
  });

  it('preserves a private booking target when callback validation fails', () => {
    expect(
      buildAuthCallbackLoginUrl(
        '/peregrinacoes/inscricao/booking-id',
        'pt',
      ),
    ).toBe(
      '/login?next=%2Fperegrinacoes%2Finscricao%2Fbooking-id',
    );
  });

  it('rejects external and protocol-relative next redirects', () => {
    expect(
      resolveAuthCallbackRedirect({ next: '//evil.example/path' }),
    ).toBe('/member');
    expect(
      buildAuthCallbackLoginUrl('https://evil.example/path', 'pt'),
    ).toBe('/login');
  });

  it('detects PKCE recovery codes on the update-password page', () => {
    expect(
      detectUpdatePasswordAuthPayload(
        'https://app.apostoladodegarabandal.com/auth/update-password?code=abc123&type=recovery'
      )
    ).toEqual({
      kind: 'code',
      code: 'abc123',
    });
  });

  it('detects legacy recovery hash sessions on the update-password page', () => {
    expect(
      detectUpdatePasswordAuthPayload(
        'https://app.apostoladodegarabandal.com/auth/update-password#access_token=access&refresh_token=refresh&type=recovery'
      )
    ).toEqual({
      kind: 'session',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('does not treat Reduniq payment tokens as Supabase auth payloads', () => {
    expect(
      hasAuthCallbackPayload(
        'https://app.apostoladodegarabandal.com/en/thank-you?type=donation&amount=25&provider=reduniq&orderRef=reduniq_123&status=success&token=reduniq-payment-token'
      )
    ).toBe(false);
  });

  it('does not treat generic payment errors as Supabase auth payloads', () => {
    expect(
      hasAuthCallbackPayload(
        'https://app.apostoladodegarabandal.com/en/thank-you?type=donation&provider=reduniq&error=payment_failed&error_description=Declined'
      )
    ).toBe(false);
  });

  it('detects Supabase OTP token links only for auth token types', () => {
    expect(
      hasAuthCallbackPayload(
        'https://app.apostoladodegarabandal.com/en/auth/confirm?type=recovery&token_hash=supabase-token'
      )
    ).toBe(true);
  });

  it('detects Supabase auth errors with error codes', () => {
    expect(
      hasAuthCallbackPayload(
        'https://app.apostoladodegarabandal.com/en?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
      )
    ).toBe(true);
  });

  it('detects Supabase PKCE and hash session callback payloads', () => {
    expect(
      hasAuthCallbackPayload(
        'https://app.apostoladodegarabandal.com/en?code=pkce-code&type=signup'
      )
    ).toBe(true);

    expect(
      hasAuthCallbackPayload(
        'https://app.apostoladodegarabandal.com/en#access_token=access&refresh_token=refresh&type=signup'
      )
    ).toBe(true);
  });
});
