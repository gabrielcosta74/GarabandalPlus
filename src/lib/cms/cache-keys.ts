/**
 * Centralized cache invalidation paths. Server actions call these after writes
 * so we never forget to revalidate something.
 */

// ES/FR have no dedicated public routes yet (content-only locales), so nothing
// to revalidate for them — their ISR pages refresh on their own interval.
export function pagePublicPaths(slug: string, locale: 'pt' | 'en' | 'es' | 'fr' | 'it'): string[] {
  if (locale === 'es' || locale === 'fr' || locale === 'it') return [];
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  return [`${prefix}/${slug}`];
}

export function postPublicPaths(slug: string, locale: 'pt' | 'en' | 'es' | 'fr' | 'it'): string[] {
  if (locale === 'es' || locale === 'fr' || locale === 'it') return [];
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  return [`${prefix}/l/${slug}`, `${prefix}/l`];
}

export const SITEMAP_PATH = '/sitemap.xml';
