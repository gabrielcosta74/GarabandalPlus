import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/maria-sinais/[...path]/route';

afterEach(() => vi.unstubAllGlobals());

describe('PostHog proxy', () => {
  it('forwards the real visitor IP without Cloudflare or site credentials', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('https://apostoladodegarabandal.com/maria-sinais/e/', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '203.0.113.25',
        'x-forwarded-for': '198.51.100.8, 192.0.2.1',
        cookie: 'session=private',
        authorization: 'Bearer private',
      },
      body: '{}',
    });

    await POST(request, { params: Promise.resolve({ path: ['e'] }) });

    const [target, options] = upstream.mock.calls[0] as [URL, RequestInit];
    const headers = options.headers as Headers;
    expect(target.origin).toBe('https://us.i.posthog.com');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.25');
    expect(headers.get('cf-connecting-ip')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
  });

  it('uses a validated forwarded IP when Cloudflare does not provide one', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('https://apostoladodegarabandal.com/maria-sinais/batch/', {
      headers: { 'x-forwarded-for': '2001:db8::1, 198.51.100.8' },
    });

    await GET(request, { params: Promise.resolve({ path: ['batch'] }) });

    expect((upstream.mock.calls[0][1].headers as Headers).get('x-forwarded-for'))
      .toBe('2001:db8::1');
  });

  it('does not forward an invalid visitor IP', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('https://apostoladodegarabandal.com/maria-sinais/e/', {
      headers: { 'cf-connecting-ip': 'not-an-ip', 'x-forwarded-for': 'also-invalid' },
    });

    await GET(request, { params: Promise.resolve({ path: ['e'] }) });

    expect((upstream.mock.calls[0][1].headers as Headers).get('x-forwarded-for'))
      .toBeNull();
  });
});
