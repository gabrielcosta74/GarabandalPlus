import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase';
import { checkRateLimit } from '../../../lib/rate-limit';

/**
 * Ingestão do tracking próprio (src/lib/site-tracker.ts).
 * Nome curto e neutro para não ser apanhado por bloqueadores.
 * Não guarda IP: só usa o país que a Cloudflare já resolve.
 */

const MAX_BODY_BYTES = 32_000;
const MAX_EVENTS = 30;
const ID_PATTERN = /^(s:)?[A-Za-z0-9-]{8,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_NAME_PATTERN = /^[a-z0-9_]{2,80}$/;
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|curl|wget|python|axios|node-fetch|monitor|uptime/i;
const SESSION_TEXT_KEYS = ['landing_path', 'referrer_host', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'device', 'locale'] as const;

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

const parseBrowser = (ua: string) => {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung';
  if (/fban|fbav|instagram/i.test(ua)) return 'Facebook/Instagram';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Outro';
};

const parseOs = (ua: string) => {
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Outro';
};

const cleanProps = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([key, value]) => /^[a-z0-9_]{1,60}$/i.test(key)
      && (value === null || ['string', 'number', 'boolean'].includes(typeof value)))
    .slice(0, 25)
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 200) : value]);
  return Object.fromEntries(entries);
};

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT_PATTERN.test(ua)) return new NextResponse(null, { status: 204 });

  const rateLimit = checkRateLimit(req, { keyPrefix: 'site-track', windowMs: 60_000, max: 120 });
  if (!rateLimit.allowed) return new NextResponse(null, { status: 429 });

  if (!supabaseServer) return new NextResponse(null, { status: 204 });

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const visitorId = text(body?.visitor?.id, 70);
  const sessionId = text(body?.session?.id, 70);
  if (!visitorId || !sessionId || !ID_PATTERN.test(visitorId) || !ID_PATTERN.test(sessionId)) {
    return new NextResponse(null, { status: 400 });
  }

  const events = (Array.isArray(body?.events) ? body.events : [])
    .slice(0, MAX_EVENTS)
    .filter((event: any) => typeof event?.name === 'string' && EVENT_NAME_PATTERN.test(event.name))
    .map((event: any) => {
      const ts = text(event.ts, 40);
      const parsedTs = ts ? Date.parse(ts) : NaN;
      const pilgrimageId = text(event.pilgrimage_id, 36);
      return {
        name: event.name,
        path: text(event.path, 300),
        ts: Number.isFinite(parsedTs) ? new Date(parsedTs).toISOString() : null,
        pilgrimage_id: pilgrimageId && UUID_PATTERN.test(pilgrimageId) ? pilgrimageId : null,
        props: cleanProps(event.props),
      };
    });
  if (!events.length) return new NextResponse(null, { status: 204 });

  const session: Record<string, string | null> = { id: sessionId };
  for (const key of SESSION_TEXT_KEYS) session[key] = text(body.session?.[key], key === 'landing_path' ? 300 : 120);
  session.browser = parseBrowser(ua);
  session.os = parseOs(ua);
  const country = req.headers.get('cf-ipcountry');
  session.country = country && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null;

  try {
    const { error } = await supabaseServer.rpc('site_track', {
      p_visitor: { id: visitorId, persistent: body.visitor?.persistent === true },
      p_session: session,
      p_events: events,
    });
    if (error) console.warn('[site-track] ingest failed:', error.message);
  } catch (err) {
    console.warn('[site-track] ingest failed:', err);
  }

  return new NextResponse(null, { status: 204 });
}
