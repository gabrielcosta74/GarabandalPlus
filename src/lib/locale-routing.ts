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
