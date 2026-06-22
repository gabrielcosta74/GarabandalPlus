import { APP_URL } from '../config';
import { hreflangKey, localizedContentPath } from './locale-paths';
import type { ContentLocale, TranslationPeer } from './queries';

/**
 * Shared SEO builders for migrated devotional content (pages + posts) so every
 * locale variant emits consistent hreflang maps and JSON-LD structured data.
 */

const PUBLISHER = {
  '@type': 'Organization' as const,
  name: 'Apostolado de Garabandal',
  logo: { '@type': 'ImageObject' as const, url: `${APP_URL}/opengraph-image` },
};

/**
 * Build the `alternates.languages` map for a content piece, including an
 * `x-default` that points at the Portuguese original (the canonical source
 * language) when it exists, otherwise at the current page. Only published peers
 * are passed in, so we never advertise a draft translation.
 */
export function buildHreflang(
  kind: 'page' | 'post',
  selfLocale: ContentLocale,
  selfSlug: string,
  peers: TranslationPeer[],
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const p of peers) {
    languages[hreflangKey(p.locale)] = `${APP_URL}${localizedContentPath(kind, p.locale, p.slug)}`;
  }
  // The current page is always present even if it isn't yet linked to a group.
  const selfUrl = `${APP_URL}${localizedContentPath(kind, selfLocale, selfSlug)}`;
  languages[hreflangKey(selfLocale)] = selfUrl;

  const ptPeer = peers.find((p) => p.locale === 'pt');
  languages['x-default'] = ptPeer
    ? `${APP_URL}${localizedContentPath(kind, 'pt', ptPeer.slug)}`
    : selfUrl;

  return languages;
}

type ArticleLdInput = {
  kind: 'page' | 'post';
  locale: ContentLocale;
  slug: string;
  title: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
};

/** Article structured data (schema.org) for a content page or post. */
export function articleJsonLd(input: ArticleLdInput) {
  const url = `${APP_URL}${localizedContentPath(input.kind, input.locale, input.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description ?? undefined,
    image: input.image ? [input.image] : undefined,
    datePublished: input.datePublished ?? undefined,
    dateModified: input.dateModified ?? input.datePublished ?? undefined,
    author: PUBLISHER,
    publisher: PUBLISHER,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: input.locale,
  };
}

/** BreadcrumbList structured data; items without a path render as the last crumb. */
export function breadcrumbJsonLd(items: Array<{ name: string; path?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: `${APP_URL}${it.path}` } : {}),
    })),
  };
}

/** Serialize one or more JSON-LD objects for a single <script> tag. */
export function jsonLdScript(...blocks: object[]): string {
  return JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
}
