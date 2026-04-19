export type AppLocale = 'pt' | 'en';

export const getLocaleFromPathname = (pathname?: string | null): AppLocale =>
  pathname?.startsWith('/en') ? 'en' : 'pt';

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
