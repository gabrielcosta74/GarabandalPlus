import type { ContentLocale } from './queries';

/**
 * Shared locale → URL helpers for migrated devotional content.
 *
 * URL structure (kept identical to the legacy Webnode site so SEO is preserved):
 *   PT page  → /<slug>            PT post → /l/<slug>
 *   EN page  → /en/<slug>         EN post → /en/l/<slug>
 *   ES page  → /es/<slug>         ES post → /es/l/<slug>
 */

/** hreflang attribute value for each content locale. */
const HREFLANG: Record<ContentLocale, string> = {
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
  fr: 'fr',
  it: 'it',
};

export function hreflangKey(locale: ContentLocale): string {
  return HREFLANG[locale];
}

/** Path (with leading slash, no host) for a content piece in a given locale. */
export function localizedContentPath(
  kind: 'page' | 'post',
  locale: ContentLocale,
  slug: string,
): string {
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  return kind === 'post' ? `${prefix}/l/${slug}` : `${prefix}/${slug}`;
}
