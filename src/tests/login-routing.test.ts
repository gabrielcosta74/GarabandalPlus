import { describe, expect, it } from 'vitest';
import { resolveLoginTarget } from '../lib/login-routing';

describe('login routing', () => {
  it('keeps non-member English logins on the English public home', () => {
    expect(resolveLoginTarget(null, false, true)).toBe('/en');
    expect(resolveLoginTarget('/', false, true)).toBe('/en');
    expect(resolveLoginTarget('/member', false, true)).toBe('/en');
  });

  it('sends active English members to the English member area', () => {
    expect(resolveLoginTarget(null, true, true)).toBe('/en/member');
    expect(resolveLoginTarget('/member', true, true)).toBe('/en/member');
    expect(resolveLoginTarget('/member/quota', true, true)).toBe('/en/member/quota');
  });

  it('keeps explicit English next paths', () => {
    expect(resolveLoginTarget('/en/donations', false, true)).toBe('/en/donations');
    expect(resolveLoginTarget('/en/member/quota', true, true)).toBe('/en/member/quota');
  });

  it('preserves Portuguese defaults outside the English app', () => {
    expect(resolveLoginTarget(null, false, false)).toBe('/');
    expect(resolveLoginTarget(null, true, false)).toBe('/member');
    expect(resolveLoginTarget('/donations', false, false)).toBe('/donations');
  });
});
