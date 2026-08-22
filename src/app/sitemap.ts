import type { MetadataRoute } from 'next';
import { APP_URL } from '../lib/config';
import { supabaseServer } from '../lib/supabase';
import { buildProductPath } from '../lib/slug';
import { getPilgrimageSeoImages } from '../lib/seo';
import { localizeStoreProductText } from '../lib/store-i18n';
import { type StoreProductSitemapRecord } from '../lib/store-products';
import { CATEGORIES, PUBLIC_NAV_ORDER, PUBLIC_LOCALES, localePrefix, type CategoryKey, type PublicLocale } from '../lib/cms/categories';
import { hreflangKey } from '../lib/content/locale-paths';
import { isPreLaunch } from '../lib/pilgrimage-early-access';

export const revalidate = 3600;

const getSitemapDate = (value?: string | null, fallback = new Date()) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const getAbsoluteImageUrl = (image?: string | null) => {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${APP_URL}${image.startsWith('/') ? image : `/${image}`}`;
};

type SitemapContentRow = {
  id: string;
  slug: string;
  locale: string;
  updated_at: string;
  published_at?: string | null;
  cover_image_url?: string | null;
  og_image_url: string | null;
};

type TranslationLink = {
  group_id: string;
  content_type: 'page' | 'post';
  content_id: string;
};

const contentUrl = (kind: 'page' | 'post', row: SitemapContentRow) => {
  const localePrefix = row.locale === 'pt' ? '' : `/${row.locale}`;
  const typePrefix = kind === 'post' ? '/l' : '';
  return `${APP_URL}${localePrefix}${typePrefix}/${row.slug}`;
};

/** Build sitemap hreflang from the CMS translation group, not matching slugs. */
function appendTranslatedContentRoutes(
  target: MetadataRoute.Sitemap,
  kind: 'page' | 'post',
  rows: SitemapContentRow[],
  links: TranslationLink[],
  fallbackDate: Date,
) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const groupByContentId = new Map(
    links
      .filter((link) => link.content_type === kind)
      .map((link) => [link.content_id, link.group_id]),
  );
  const contentIdsByGroup = new Map<string, string[]>();

  for (const link of links) {
    if (link.content_type !== kind) continue;
    const ids = contentIdsByGroup.get(link.group_id) ?? [];
    ids.push(link.content_id);
    contentIdsByGroup.set(link.group_id, ids);
  }

  for (const row of rows) {
    const groupId = groupByContentId.get(row.id);
    const peerIds = groupId ? contentIdsByGroup.get(groupId) ?? [] : [];
    const peers = peerIds
      .map((id) => rowsById.get(id))
      .filter((peer): peer is SitemapContentRow => Boolean(peer));
    if (!peers.some((peer) => peer.id === row.id)) peers.push(row);

    const languages: Record<string, string> = {};
    for (const peer of peers) {
      languages[hreflangKey(peer.locale as 'pt' | 'en' | 'es' | 'fr' | 'it')] = contentUrl(kind, peer);
    }
    const portuguesePeer = peers.find((peer) => peer.locale === 'pt');
    languages['x-default'] = contentUrl(kind, portuguesePeer ?? row);

    const image = kind === 'post'
      ? row.cover_image_url ?? row.og_image_url
      : row.og_image_url;

    target.push({
      url: contentUrl(kind, row),
      lastModified: getSitemapDate(row.updated_at, fallbackDate),
      changeFrequency: kind === 'post' ? 'weekly' : 'monthly',
      priority: kind === 'post' ? 0.65 : 0.7,
      images: image ? [image] : undefined,
      alternates: { languages },
    });
  }
}

async function fetchSitemapProducts(): Promise<StoreProductSitemapRecord[]> {
  if (!supabaseServer) return [];

  const withDates = await supabaseServer
    .from('store_products')
    .select('product_id, name, name_en, image_url, updated_at, created_at')
    .eq('is_active', true);

  if (!withDates.error) return (withDates.data || []) as StoreProductSitemapRecord[];

  const fallback = await supabaseServer
    .from('store_products')
    .select('product_id, name, name_en, image_url, created_at')
    .eq('is_active', true);

  return (fallback.data || []) as StoreProductSitemapRecord[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const baseRoutes: MetadataRoute.Sitemap = [
    // ── Core pages ──────────────────────────────────────────────────
    {
      url: `${APP_URL}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${APP_URL}/peregrinacoes`,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${APP_URL}/loja`,
      changeFrequency: 'weekly',
      priority: 0.85,
      alternates: {
        languages: {
          'pt-BR': `${APP_URL}/loja`,
          'pt-PT': `${APP_URL}/loja`,
          en: `${APP_URL}/en/store`,
        },
      },
    },
    {
      url: `${APP_URL}/donations`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${APP_URL}/leilao`,
      changeFrequency: 'daily',
      priority: 0.85,
      alternates: {
        languages: {
          'pt-BR': `${APP_URL}/leilao`,
          'pt-PT': `${APP_URL}/leilao`,
          en: `${APP_URL}/en/auction`,
        },
      },
    },
    {
      url: `${APP_URL}/tornar-membro`,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${APP_URL}/sobre-nos`,
      changeFrequency: 'monthly',
      priority: 0.65,
    },
    {
      url: `${APP_URL}/intencoes`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/transparencia`,
      changeFrequency: 'monthly',
      priority: 0.55,
    },
    // ── English versions ─────────────────────────────────────────────
    {
      url: `${APP_URL}/en`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${APP_URL}/en/pilgrimages`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${APP_URL}/en/store`,
      changeFrequency: 'weekly',
      priority: 0.65,
      alternates: {
        languages: {
          en: `${APP_URL}/en/store`,
          'pt-BR': `${APP_URL}/loja`,
          'pt-PT': `${APP_URL}/loja`,
        },
      },
    },
    {
      url: `${APP_URL}/en/donations`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/en/auction`,
      changeFrequency: 'daily',
      priority: 0.7,
      alternates: {
        languages: {
          en: `${APP_URL}/en/auction`,
          'pt-BR': `${APP_URL}/leilao`,
          'pt-PT': `${APP_URL}/leilao`,
        },
      },
    },
    {
      url: `${APP_URL}/en/become-member`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/en/about`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${APP_URL}/en/intentions`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${APP_URL}/en/privacy`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${APP_URL}/en/terms`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${APP_URL}/en/cookies`,
      changeFrequency: 'yearly',
      priority: 0.15,
    },
    // ── Content category landings (gated until NAV_V2 cutover) ───────
    // Until Sprint 7, these routes 404 for public crawlers (preview-cookie
    // gated), so we keep them out of the sitemap. After cutover, flip the
    // env flag and they'll be advertised automatically.
    ...(process.env.NEXT_PUBLIC_NAV_V2 === '1'
      ? [...PUBLIC_NAV_ORDER, 'noticias' as const].flatMap((key: CategoryKey) => {
          const cfg = CATEGORIES[key];
          const urlFor = (locale: PublicLocale) =>
            `${APP_URL}${localePrefix(locale)}/${cfg[locale].slug}`;
          // Full hreflang mesh across every locale that has a landing page.
          const langs = {
            'pt-BR': urlFor('pt'),
            'pt-PT': urlFor('pt'),
            en: urlFor('en'),
            es: urlFor('es'),
            fr: urlFor('fr'),
            it: urlFor('it'),
            'x-default': urlFor('pt'),
          };
          return PUBLIC_LOCALES.map((locale) => ({
            url: urlFor(locale),
            changeFrequency: 'weekly' as const,
            priority: locale === 'pt' ? 0.85 : 0.75,
            alternates: { languages: langs },
          }));
        })
      : []),
    // ── Legal ────────────────────────────────────────────────────────
    {
      url: `${APP_URL}/termos`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${APP_URL}/privacidade`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${APP_URL}/cookies`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${APP_URL}/loja/politica-devolucao`,
      changeFrequency: 'yearly',
      priority: 0.3,
      alternates: {
        languages: {
          'pt-BR': `${APP_URL}/loja/politica-devolucao`,
          'pt-PT': `${APP_URL}/loja/politica-devolucao`,
          en: `${APP_URL}/en/store/return-policy`,
        },
      },
    },
    {
      url: `${APP_URL}/en/store/return-policy`,
      changeFrequency: 'yearly',
      priority: 0.2,
      alternates: {
        languages: {
          en: `${APP_URL}/en/store/return-policy`,
          'pt-BR': `${APP_URL}/loja/politica-devolucao`,
          'pt-PT': `${APP_URL}/loja/politica-devolucao`,
        },
      },
    },
  ];

  if (!supabaseServer) {
    return baseRoutes;
  }

  const dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    const products = await fetchSitemapProducts();

    (products || []).forEach((product) => {
      if (product?.product_id) {
        const englishName = localizeStoreProductText(product, 'en').name;
        const ptUrl = `${APP_URL}${buildProductPath(product.product_id, product.name, 'pt')}`;
        const enUrl = `${APP_URL}${buildProductPath(product.product_id, englishName, 'en')}`;
        const lastModified = getSitemapDate(product.updated_at || product.created_at, now);
        const imageUrl = getAbsoluteImageUrl(product.image_url);
        const shared = {
          lastModified,
          changeFrequency: 'weekly' as const,
          images: imageUrl ? [imageUrl] : undefined,
        };

        dynamicRoutes.push({
          url: ptUrl,
          ...shared,
          priority: 0.8,
          alternates: {
            languages: {
              'pt-BR': ptUrl,
              'pt-PT': ptUrl,
              en: enUrl,
            },
          },
        });
        dynamicRoutes.push({
          url: enUrl,
          ...shared,
          priority: 0.7,
          alternates: {
            languages: {
              en: enUrl,
              'pt-BR': ptUrl,
              'pt-PT': ptUrl,
            },
          },
        });
      }
    });

    const statusEnv = process.env.NEXT_PUBLIC_PILGRIMAGE_STATUSES;
    const statusFilter = statusEnv
      ? statusEnv.split(',').map((s) => s.trim()).filter(Boolean)
      : ['open', 'waitlist', 'active', 'ativo'];

    let pilgrimagesQuery = supabaseServer
      .from('pilgrimages')
      .select('slug, status, cover_image, updated_at, created_at, pricing_config')
      .order('start_date', { ascending: true });

    if (statusFilter.length > 0) {
      pilgrimagesQuery = pilgrimagesQuery.in('status', statusFilter);
    }

    const { data: pilgrimages } = await pilgrimagesQuery;

    (pilgrimages || []).forEach((pilgrimage: any) => {
      // Never expose a private early-access pilgrimage to crawlers before launch.
      if (pilgrimage?.slug && !isPreLaunch(pilgrimage)) {
        const ptUrl = `${APP_URL}/peregrinacoes/${pilgrimage.slug}`;
        const enUrl = `${APP_URL}/en/pilgrimages/${pilgrimage.slug}`;
        dynamicRoutes.push({
          url: ptUrl,
          lastModified: getSitemapDate(pilgrimage.updated_at || pilgrimage.created_at, now),
          changeFrequency: 'weekly',
          priority: 0.9,
          images: getPilgrimageSeoImages(pilgrimage.cover_image),
          alternates: {
            languages: {
              'pt-BR': ptUrl,
              'pt-PT': ptUrl,
              en: enUrl,
            },
          },
        });
      }
    });

    // ── Active auction items ────────────────────────────────────────────
    const { data: auctionItems } = await supabaseServer
      .from('auction_items')
      .select('id, updated_at, created_at, images, ends_at')
      .in('status', ['active', 'awaiting_payment'])
      .order('ends_at', { ascending: true });

    (auctionItems || []).forEach((it: any) => {
      if (!it?.id) return;
      const url = `${APP_URL}/leilao/${it.id}`;
      const cover = Array.isArray(it.images) && it.images[0] ? getAbsoluteImageUrl(it.images[0]) : undefined;
      dynamicRoutes.push({
        url,
        lastModified: getSitemapDate(it.updated_at || it.created_at, now),
        changeFrequency: 'hourly',
        priority: 0.75,
        images: cover ? [cover] : undefined,
      });
    });

    // ── Migrated devotional content (wp_pages + posts) ──────────────────
    // Only emit when status='published'. Drafts stay invisible to crawlers.
    const [{ data: pubPages }, { data: pubPosts }, { data: translationLinks }] = await Promise.all([
      supabaseServer
        .from('wp_pages')
        .select('id, slug, locale, updated_at, og_image_url')
        .eq('status', 'published'),
      supabaseServer
        .from('posts')
        .select('id, slug, locale, updated_at, published_at, cover_image_url, og_image_url')
        .eq('status', 'published'),
      supabaseServer
        .from('content_translations')
        .select('group_id, content_type, content_id')
        .in('content_type', ['page', 'post']),
    ]);

    // Blog index pages — only emit when there are actually posts to list.
    if ((pubPosts?.length ?? 0) > 0) {
      const ptPosts = pubPosts!.filter((p) => p.locale === 'pt');
      const enPosts = pubPosts!.filter((p) => p.locale === 'en');
      const esPosts = pubPosts!.filter((p) => p.locale === 'es');
      const frPosts = pubPosts!.filter((p) => p.locale === 'fr');
      const itPosts = pubPosts!.filter((p) => p.locale === 'it');
      const langs: Record<string, string> = {
        'pt-BR': `${APP_URL}/l`,
        en: `${APP_URL}/en/l`,
      };
      if (esPosts.length > 0) langs.es = `${APP_URL}/es/l`;
      if (frPosts.length > 0) langs.fr = `${APP_URL}/fr/l`;
      if (itPosts.length > 0) langs.it = `${APP_URL}/it/l`;
      if (ptPosts.length > 0) {
        const latest = ptPosts.reduce((acc, p) => (p.updated_at > acc ? p.updated_at : acc), ptPosts[0].updated_at);
        dynamicRoutes.push({
          url: `${APP_URL}/l`,
          lastModified: getSitemapDate(latest, now),
          changeFrequency: 'weekly',
          priority: 0.8,
          alternates: { languages: langs },
        });
      }
      if (enPosts.length > 0) {
        const latest = enPosts.reduce((acc, p) => (p.updated_at > acc ? p.updated_at : acc), enPosts[0].updated_at);
        dynamicRoutes.push({
          url: `${APP_URL}/en/l`,
          lastModified: getSitemapDate(latest, now),
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: { languages: langs },
        });
      }
      if (esPosts.length > 0) {
        const latest = esPosts.reduce((acc, p) => (p.updated_at > acc ? p.updated_at : acc), esPosts[0].updated_at);
        dynamicRoutes.push({
          url: `${APP_URL}/es/l`,
          lastModified: getSitemapDate(latest, now),
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: { languages: langs },
        });
      }
      if (frPosts.length > 0) {
        const latest = frPosts.reduce((acc, p) => (p.updated_at > acc ? p.updated_at : acc), frPosts[0].updated_at);
        dynamicRoutes.push({
          url: `${APP_URL}/fr/l`,
          lastModified: getSitemapDate(latest, now),
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: { languages: langs },
        });
      }
      if (itPosts.length > 0) {
        const latest = itPosts.reduce((acc, p) => (p.updated_at > acc ? p.updated_at : acc), itPosts[0].updated_at);
        dynamicRoutes.push({
          url: `${APP_URL}/it/l`,
          lastModified: getSitemapDate(latest, now),
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: { languages: langs },
        });
      }
    }

    appendTranslatedContentRoutes(
      dynamicRoutes,
      'page',
      (pubPages ?? []) as SitemapContentRow[],
      (translationLinks ?? []) as TranslationLink[],
      now,
    );
    appendTranslatedContentRoutes(
      dynamicRoutes,
      'post',
      (pubPosts ?? []) as SitemapContentRow[],
      (translationLinks ?? []) as TranslationLink[],
      now,
    );
  } catch {
    return baseRoutes;
  }

  // A few migrated CMS pages share their URL with curated category routes.
  // Advertise each canonical URL only once; duplicate <loc> entries waste
  // crawl attention and make Search Console's discovered-page counts noisy.
  const seenUrls = new Set<string>();
  return [...baseRoutes, ...dynamicRoutes].filter((entry) => {
    if (seenUrls.has(entry.url)) return false;
    seenUrls.add(entry.url);
    return true;
  });
}
