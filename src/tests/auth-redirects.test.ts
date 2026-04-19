import { describe, expect, it } from 'vitest';
import {
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
      'https://app.apostoladodegarabandal.com/auth-callback?next=%2Fauth%2Fupdate-password&type=recovery'
    );
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
