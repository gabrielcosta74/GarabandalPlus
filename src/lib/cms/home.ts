import { PUBLIC_NAV_ORDER, CATEGORIES, type CategoryKey } from './categories';
import { cmsListCategoryHighlights, cmsListLatestPosts, type NavItem, type CmsStatus } from './queries';

/**
 * Server-side data for the restructured homepage (devotional content first).
 * Preview-aware via `statuses` — pre-cutover (drafts) only admins in preview
 * get content, so the public homepage stays unchanged until publish; the home
 * sections self-hide when empty.
 */
export type HomeCategory = {
  key: CategoryKey;
  label: string;
  intro: string;
  href: string;
  cover: string | null;
};

export type HomeArticle = {
  title: string;
  href: string;
  image: string | null;
  excerpt: string | null;
  /** ISO publish date, when known — used by the "Artigos" band. */
  date: string | null;
};

export type HomeContent = {
  categories: HomeCategory[];
  featured: HomeArticle[];
  latestNews: HomeArticle[];
  /** Latest items from the "Artigos" (posts) content type — served at /l/<slug>. */
  articles: HomeArticle[];
};

function toArticle(locale: 'pt' | 'en', item: NavItem): HomeArticle {
  const prefix = locale === 'pt' ? '' : '/en';
  const href = item.type === 'page' ? `${prefix}/${item.slug}` : `${prefix}/l/${item.slug}`;
  return {
    title: item.title,
    href,
    image: item.cover_image_url ?? item.og_image_url ?? null,
    excerpt: item.meta_description ?? item.excerpt ?? null,
    date: item.published_at ?? null,
  };
}

export async function getHomeContent(
  locale: 'pt' | 'en',
  statuses: CmsStatus[],
): Promise<HomeContent> {
  const prefix = locale === 'pt' ? '' : '/en';

  const perCat = await Promise.all(
    PUBLIC_NAV_ORDER.map((k) => cmsListCategoryHighlights(k, locale, { limit: 4, statuses })),
  );

  const categories: HomeCategory[] = PUBLIC_NAV_ORDER.map((k, i) => {
    const cfg = CATEGORIES[k][locale];
    const top = perCat[i][0];
    return {
      key: k,
      label: cfg.label,
      intro: cfg.tagline,
      href: `${prefix}/${cfg.slug}`,
      cover: top?.cover_image_url ?? top?.og_image_url ?? null,
    };
  });

  // Featured: round-robin across categories for variety, capped at 6.
  const featured: HomeArticle[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 4 && featured.length < 6; round++) {
    for (const items of perCat) {
      const it = items[round];
      if (it && !seen.has(it.id)) {
        seen.add(it.id);
        featured.push(toArticle(locale, it));
        if (featured.length >= 6) break;
      }
    }
  }

  const news = await cmsListCategoryHighlights('noticias', locale, { limit: 4, statuses });
  const latestNews = news.map((it) => toArticle(locale, it));

  const latestPosts = await cmsListLatestPosts(locale, { limit: 6, statuses });
  const articles = latestPosts.map((it) => toArticle(locale, it));

  return { categories, featured, latestNews, articles };
}
