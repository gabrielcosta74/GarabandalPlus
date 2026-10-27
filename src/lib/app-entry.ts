import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { getPostHogClient } from './posthog-server';
import {
  buildAppLinks,
  isBotUserAgent,
  platformFromUserAgent,
  sanitizeSource,
  type AppLinks,
  type AppPlatform,
} from './app-links';

// Cloudflare uses XX for "unknown" and T1 for Tor.
const UNKNOWN_COUNTRIES = new Set(['XX', 'T1', '']);

/** Visitor country from the edge, or null. Pages are cached, so only call this from dynamic routes. */
export function countryFromHeaders(h: Headers): string | null {
  const raw = (h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || '').toUpperCase();
  return UNKNOWN_COUNTRIES.has(raw) ? null : raw;
}

/** Everything the /app entry point needs to choose between redirecting and showing the landing page. */
export async function resolveAppEntry(
  locale: 'pt' | 'en',
  rawSource: string | string[] | undefined,
): Promise<{ links: AppLinks; platform: AppPlatform; country: string | null }> {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  const country = countryFromHeaders(h);
  const source = sanitizeSource(rawSource);
  const links = buildAppLinks({ country, locale, source });
  const bot = isBotUserAgent(ua);
  const platform = bot ? 'desktop' : platformFromUserAgent(ua);
  // Phones are redirected before any page loads, so the browser never reports a
  // pageview: this is the only place a tap on a shared link can be counted.
  // Anonymous on purpose (a fresh id per tap, no cookies, no IP).
  if (!bot) {
    getPostHogClient()?.capture({
      distinctId: randomUUID(),
      event: 'app_link_opened',
      properties: { $process_person_profile: false, country, locale, platform, source },
    });
  }
  return { links, platform, country };
}
