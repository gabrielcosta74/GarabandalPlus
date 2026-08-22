import { NextResponse, type NextRequest } from 'next/server';

/**
 * Reverse proxy for PostHog.
 *
 * This replaces the `rewrites` that used to live in next.config.js. Those
 * rewrites proxied to `us-assets.i.posthog.com` without rewriting the `Host`
 * header, so the request arrived at PostHog carrying
 * `Host: apostoladodegarabandal.com`. PostHog is itself behind Cloudflare;
 * Cloudflare resolved that host, saw a Cloudflare IP, and answered with
 * error 1000 "DNS points to prohibited IP" — a 403 on every
 * /maria-sinais/static/* and /maria-sinais/array/* request, which meant
 * posthog-js could never load and analytics recorded nothing.
 *
 * Doing the fetch ourselves lets us send the upstream's own Host, which is what
 * `fetch(new URL(...))` does by default.
 *
 * The path exists (rather than pointing posthog-js straight at PostHog) so the
 * requests are first-party and survive ad blockers.
 */

const ASSETS_HOST = 'https://us-assets.i.posthog.com';
const INGEST_HOST = 'https://us.i.posthog.com';

/** Static assets and the feature-flag bundle live on the assets host. */
function upstreamFor(path: string): string {
  const first = path.split('/')[0];
  const base = first === 'static' || first === 'array' ? ASSETS_HOST : INGEST_HOST;
  return `${base}/${path}`;
}

/** Headers that must not be forwarded upstream. `host` is the whole point of
 *  this file; the hop-by-hop ones are meaningless to a new connection. */
const STRIP_REQUEST = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'proxy-connection', 'te', 'trailer',
  // Let undici negotiate its own encoding and decode for us.
  'accept-encoding', 'content-length',
]);

/** `fetch` already decoded the body, so passing these through would make the
 *  browser try to decode it a second time. */
const STRIP_RESPONSE = new Set([
  'content-encoding', 'content-length', 'transfer-encoding', 'connection',
]);

async function proxy(request: NextRequest, path: string[]) {
  const suffix = path.join('/');
  if (!suffix) return new NextResponse('Not found', { status: 404 });

  const target = new URL(upstreamFor(suffix));
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch {
    // Never let an analytics outage surface as a page error.
    return new NextResponse(null, { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function OPTIONS(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function HEAD(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}

export const dynamic = 'force-dynamic';
