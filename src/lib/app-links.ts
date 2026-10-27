/**
 * Store links for the Garabandal+ mobile app.
 *
 * Both stores already send a visitor to their own storefront when the URL has
 * no country, so the generic links are always safe. Region only refines them:
 *   - App Store: a country segment (`/br/`, `/pt/`) pins the storefront, which
 *     matters on desktop where Apple cannot infer it from a signed-in device.
 *   - Google Play: `hl` sets the language of the listing.
 * Extend APP_STORE_COUNTRIES only with storefronts where the app is published,
 * otherwise Apple shows "not available" instead of redirecting.
 */

import { CANONICAL_APP_URL } from './config';

const APP_STORE_ID = '6806348119';
export const GOOGLE_PLAY_PACKAGE = 'com.apostoladodegarabandal.membros';

const APP_STORE_COUNTRIES = new Set(['BR', 'PT']);

const PLAY_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  BR: 'pt_BR',
  PT: 'pt_PT',
  ES: 'es',
  FR: 'fr',
  IT: 'it',
};

export type AppPlatform = 'ios' | 'android' | 'desktop';

export type AppLinks = { appStore: string; googlePlay: string };

/** Best-effort platform from the browser. Client only. */
export function detectPlatform(): AppPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  // iPadOS reports itself as a Mac; touch points tell them apart.
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || isIpadOs) return 'ios';
  return 'desktop';
}

/** First region subtag in the browser's language list (`pt-BR` → `BR`). */
export function regionFromLanguages(languages: readonly string[]): string | null {
  for (const tag of languages) {
    const region = tag.split('-')[1]?.toUpperCase();
    if (region && /^[A-Z]{2}$/.test(region)) return region;
  }
  return null;
}

export function buildAppLinks({
  country,
  locale,
  source,
}: {
  /** ISO 3166-1 alpha-2, any case; `null` when unknown. */
  country?: string | null;
  locale: 'pt' | 'en';
  /** Goes into the Play install referrer as utm_medium. */
  source: string;
}): AppLinks {
  const cc = country?.toUpperCase() ?? null;

  const storefront = cc && APP_STORE_COUNTRIES.has(cc) ? `${cc.toLowerCase()}/` : '';
  const appStore = `https://apps.apple.com/${storefront}app/garabandal/id${APP_STORE_ID}`;

  const hl = (cc && PLAY_LANGUAGE_BY_COUNTRY[cc]) || (locale === 'pt' ? 'pt_PT' : 'en');
  const referrer = encodeURIComponent(`utm_source=site&utm_medium=${source}&utm_campaign=app`);
  const googlePlay = `https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_PACKAGE}&hl=${hl}&referrer=${referrer}`;

  return { appStore, googlePlay };
}

/** Server-side platform guess from a User-Agent (iPadOS in desktop mode is not detectable here). */
export function platformFromUserAgent(ua: string): AppPlatform {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}

/** Crawlers must see the landing page, not a store redirect. */
export function isBotUserAgent(ua: string): boolean {
  return /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|telegram|linkedin|pinterest/i.test(ua);
}

/** Campaign tag from `?src=`, reduced to something safe for the Play referrer. */
export function sanitizeSource(raw: string | string[] | undefined | null, fallback = 'app_link'): string {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const clean = value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  return clean || fallback;
}

/**
 * Short link printed in QR codes. Always the public domain, never the current
 * origin: a QR scanned on a phone must not point at localhost or a preview host.
 */
export function appShortLink(locale: 'pt' | 'en', source: string): string {
  return `${CANONICAL_APP_URL}${locale === 'en' ? '/en/app' : '/app'}?src=${sanitizeSource(source)}`;
}
