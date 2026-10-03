import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ verificationFails: false }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      verifyOtp: async () => ({ error: state.verificationFails ? new Error('Invalid OTP') : null }),
    },
  }),
}));

import { GET } from '../app/auth/confirm/route';

const bookingPath = '/peregrinacoes/inscricao/123e4567-e89b-42d3-a456-426614174000';

function internalRequest(handoff = true) {
  const url = new URL('https://localhost:8080/auth/confirm');
  if (handoff) url.searchParams.set('handoff', 'pilgrimage');
  url.searchParams.set('token_hash', 'one-time-auth-hash');
  url.searchParams.set('type', 'magiclink');
  url.searchParams.set('next', bookingPath);
  return new NextRequest(url);
}

describe('mobile pilgrimage confirmation origin', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    state.verificationFails = false;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('redirects a successful login to the official payment page, not the proxy localhost', async () => {
    const response = await GET(internalRequest());
    expect(response.headers.get('location')).toBe(`https://apostoladodegarabandal.com${bookingPath}`);
  });

  it('redirects a failed login to the official login page, not the proxy localhost', async () => {
    state.verificationFails = true;
    const response = await GET(internalRequest());
    expect(response.headers.get('location')).toBe('https://apostoladodegarabandal.com/login?error=invalid-link');
  });

  it('also corrects the production proxy origin for links issued before the handoff marker', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await GET(internalRequest(false));
    expect(response.headers.get('location')).toBe(`https://apostoladodegarabandal.com${bookingPath}`);
  });
});

describe('auth callback origin behind the production proxy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sends a failed callback to the official login page, not the proxy localhost', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    const { GET: callback } = await import('../app/auth-callback/route');
    const response = await callback(new NextRequest('https://localhost:8080/auth-callback?error=access_denied'));
    expect(new URL(response.headers.get('location') ?? '').origin).toBe('https://apostoladodegarabandal.com');
  });

  it('keeps the request origin in local development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    const { GET: callback } = await import('../app/auth-callback/route');
    const response = await callback(new NextRequest('http://localhost:3000/auth-callback?error=access_denied'));
    expect(new URL(response.headers.get('location') ?? '').origin).toBe('http://localhost:3000');
  });
});
