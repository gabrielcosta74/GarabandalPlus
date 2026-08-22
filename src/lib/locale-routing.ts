export type AppLocale = 'pt' | 'en';

/**
 * A path is English only when its first segment is exactly `en` — i.e. `/en`
 * or `/en/...`. A bare `startsWith('/en')` wrongly matched PT slugs that merely
 * begin with the letters "en" (e.g. `/ensinamentos`, `/encomendas`), flipping
 * the whole UI to English. Always compare the segment, never the prefix.
 */
export const isEnglishPathname = (pathname?: string | null): boolean =>
  pathname === '/en' || (pathname?.startsWith('/en/') ?? false);

export const getLocaleFromPathname = (pathname?: string | null): AppLocale =>
  isEnglishPathname(pathname) ? 'en' : 'pt';

/**
 * Every locale that has a public content section, including the three that do
 * not (yet) have translated UI chrome.
 *
 * `AppLocale` stays `pt | en` because that is what the `Translations` bundles
 * cover. But navigation *links* on /es, /fr and /it must still point inside
 * their own section: resolving them as `pt` made every Spanish, French and
 * Italian page link out to the Portuguese tree, leaving ~690 URLs reachable
 * only from the sitemap and bleeding their link equity to PT.
 */
export type PublicAppLocale = 'pt' | 'en' | 'es' | 'fr' | 'it';

const PREFIXED_LOCALES = ['en', 'es', 'fr', 'it'] as const;

/**
 * Match the first path segment EXACTLY. A `startsWith('/es')` would also catch
 * PT slugs such as `/ensinamentos`, and `/fr` would catch `/frutos` — see the
 * note on `isEnglishPathname`.
 */
export const getPublicLocaleFromPathname = (pathname?: string | null): PublicAppLocale => {
  if (!pathname) return 'pt';
  for (const locale of PREFIXED_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale;
  }
  return 'pt';
};

export const getLocalePrefix = (locale: AppLocale): '' | '/en' =>
  locale === 'en' ? '/en' : '';

export const withLocalePrefix = (path: string, locale: AppLocale) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = getLocalePrefix(locale);
  return prefix ? `${prefix}${normalizedPath}` : normalizedPath;
};

export const getLocaleFromUrl = (value?: string | null): AppLocale => {
  if (!value) return 'pt';

  try {
    const pathname = new URL(value).pathname;
    return getLocaleFromPathname(pathname);
  } catch {
    return getLocaleFromPathname(value);
  }
};

export const inferRequestLocale = (request: Request): AppLocale => {
  const referer = request.headers.get('referer');
  if (referer) return getLocaleFromUrl(referer);

  const origin = request.headers.get('origin');
  if (origin) return getLocaleFromUrl(origin);

  return 'pt';
};
