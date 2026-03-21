import { describe, expect, it } from 'vitest';
import {
  buildRecoveryRedirectUrl,
  detectUpdatePasswordAuthPayload,
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
});
