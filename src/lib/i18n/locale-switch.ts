import { pt, en } from '../../i18n';
import { CATEGORIES } from '../cms/categories';
import type { LocaleCode } from '../../i18n';

/**
 * Resolve the equivalent URL for the *other* locale when the user clicks the
 * header language toggle.
 *
 * The previous implementation just prepended/stripped `/en`, which produced
 * two classes of bug:
 *   - `pathname.startsWith('/en')` matched any path that merely *began* with
 *     the letters "en" (e.g. `/ensinamentos`), then `slice(3)` chopped 3
 *     characters off the slug → `/inamentos`, a 404.
 *   - Going PT→EN it kept the PT slug (`/mensagens` → `/en/mensagens`), but the
 *     EN route uses a different slug (`/en/messages`), so it also 404'd.
 *
 * We can only translate routes we actually know the counterpart slug for:
 * the IA categories (CATEGORIES), the transactional/static routes (t.urls),
 * the hand-built about page, and the locale home. For CMS content *detail*
 * pages (article `/l/<slug>` and page `/<slug>`) the translated slug lives in
 * the database and isn't known client-side — those carry their own inline
 * LocaleSwitcher (built from translation peers). For anything we can't map we
 * fall back to the target locale's home rather than emit a broken URL.
 */

// About page is hand-built and not part of t.urls (which has /sobre-nos).
const ABOUT_HREF: Record<LocaleCode, string> = {
  pt: '/apostolado-garabandal',
  en: '/en/our-apostolate',
};

function homeFor(locale: LocaleCode): string {
  return locale === 'pt' ? '/' : '/en';
}

/** Normalize a path for comparison: strip query/hash and trailing slash. */
function cleanPath(pathname: string): string {
  const noQuery = pathname.split(/[?#]/)[0];
  return noQuery.length > 1 ? noQuery.replace(/\/+$/, '') : noQuery;
}

export function localeSwitchHref(pathname: string, to: LocaleCode): string {
  const path = cleanPath(pathname || '/');
  const from: LocaleCode = to === 'en' ? 'pt' : 'en';

  // Home (either `/` or `/en`).
  if (path === '/' || path === '/en') return homeFor(to);

  // About page.
  if (path === ABOUT_HREF[from]) return ABOUT_HREF[to];

  // IA category landing pages: /<slug> (PT) ↔ /en/<slug> (EN).
  for (const cat of Object.values(CATEGORIES)) {
    const fromHref = from === 'pt' ? `/${cat.pt.slug}` : `/en/${cat.en.slug}`;
    if (path === fromHref) {
      return to === 'pt' ? `/${cat.pt.slug}` : `/en/${cat.en.slug}`;
    }
  }

  // Transactional / static routes driven by t.urls. The PT and EN url maps are
  // parallel (same keys), so match the current path against one and return the
  // counterpart by key.
  const fromUrls = (from === 'pt' ? pt.urls : en.urls) as Record<string, string>;
  const toUrls = (to === 'pt' ? pt.urls : en.urls) as Record<string, string>;
  for (const key of Object.keys(fromUrls)) {
    if (cleanPath(fromUrls[key]) === path && toUrls[key]) {
      return toUrls[key];
    }
  }

  // Unknown route (e.g. a CMS content detail page) — don't guess a slug we
  // don't have. Send the user to the target locale's home.
  return homeFor(to);
}
