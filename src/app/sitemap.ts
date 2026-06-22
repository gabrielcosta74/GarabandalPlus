import type { MetadataRoute } from 'next';
import { APP_URL } from '../lib/config';
import { supabaseServer } from '../lib/supabase';
import { buildProductPath } from '../lib/slug';
import { getPilgrimageSeoImages } from '../lib/seo';
import { localizeStoreProductText } from '../lib/store-i18n';
import { type StoreProductSitemapRecord } from '../lib/store-products';
import { CATEGORIES, PUBLIC_NAV_ORDER, type CategoryKey } from '../lib/cms/categories';
import { hreflangKey } from '../lib/content/locale-paths';

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
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${APP_URL}/peregrinacoes`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${APP_URL}/loja`,
      lastModified: now,
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
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${APP_URL}/leilao`,
      lastModified: now,
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
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${APP_URL}/sobre-nos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.65,
    },
    {
      url: `${APP_URL}/intencoes`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/transparencia`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.55,
    },
    // ── English versions ─────────────────────────────────────────────
    {
      url: `${APP_URL}/en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${APP_URL}/en/pilgrimages`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${APP_URL}/en/store`,
      lastModified: now,
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
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/en/auction`,
      lastModified: now,
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
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/en/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${APP_URL}/en/intentions`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${APP_URL}/en/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${APP_URL}/en/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${APP_URL}/en/cookies`,
      lastModified: now,
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
          const ptUrl = `${APP_URL}/${cfg.pt.slug}`;
          const enUrl = `${APP_URL}/en/${cfg.en.slug}`;
          const langs = { 'pt-BR': ptUrl, en: enUrl };
          return [
            {
              url: ptUrl,
              lastModified: now,
              changeFrequency: 'weekly' as const,
              priority: 0.85,
              alternates: { languages: langs },
            },
            {
              url: enUrl,
              lastModified: now,
              changeFrequency: 'weekly' as const,
              priority: 0.75,
              alternates: { languages: langs },
            },
          ];
        })
      : []),
    // ── Legal ────────────────────────────────────────────────────────
    {
      url: `${APP_URL}/termos`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${APP_URL}/privacidade`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${APP_URL}/cookies`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${APP_URL}/loja/politica-devolucao`,
      lastModified: now,
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
      lastModified: now,
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
      .select('slug, status, cover_image, updated_at, created_at')
      .order('start_date', { ascending: true });

    if (statusFilter.length > 0) {
      pilgrimagesQuery = pilgrimagesQuery.in('status', statusFilter);
    }

    const { data: pilgrimages } = await pilgrimagesQuery;

    (pilgrimages || []).forEach((pilgrimage: any) => {
      if (pilgrimage?.slug) {
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
    const [{ data: pubPages }, { data: pubPosts }] = await Promise.all([
      supabaseServer
        .from('wp_pages')
        .select('slug, locale, updated_at, og_image_url')
        .eq('status', 'published'),
      supabaseServer
        .from('posts')
        .select('slug, locale, updated_at, published_at, cover_image_url, og_image_url')
        .eq('status', 'published'),
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

    // Group by slug to build hreflang maps cheaply.
    const pageBySlug = new Map<string, Array<{ slug: string; locale: string; updated_at: string; og_image_url: string | null }>>();
    for (const r of (pubPages ?? []) as any[]) {
      const arr = pageBySlug.get(r.slug) ?? [];
      arr.push(r);
      pageBySlug.set(r.slug, arr);
    }
    for (const [slug, rows] of pageBySlug) {
      const langs: Record<string, string> = {};
      for (const r of rows) {
        langs[hreflangKey(r.locale as 'pt' | 'en' | 'es')] = `${APP_URL}${r.locale === 'pt' ? '' : '/' + r.locale}/${slug}`;
      }
      for (const r of rows) {
        const url = `${APP_URL}${r.locale === 'pt' ? '' : '/' + r.locale}/${slug}`;
        dynamicRoutes.push({
          url,
          lastModified: getSitemapDate(r.updated_at, now),
          changeFrequency: 'monthly',
          priority: 0.7,
          images: r.og_image_url ? [r.og_image_url] : undefined,
          alternates: { languages: langs },
        });
      }
    }

    const postBySlug = new Map<string, Array<{ slug: string; locale: string; updated_at: string; published_at: string | null; cover_image_url: string | null; og_image_url: string | null }>>();
    for (const r of (pubPosts ?? []) as any[]) {
      const arr = postBySlug.get(r.slug) ?? [];
      arr.push(r);
      postBySlug.set(r.slug, arr);
    }
    for (const [slug, rows] of postBySlug) {
      const langs: Record<string, string> = {};
      for (const r of rows) {
        langs[hreflangKey(r.locale as 'pt' | 'en' | 'es')] = `${APP_URL}${r.locale === 'pt' ? '' : '/' + r.locale}/l/${slug}`;
      }
      for (const r of rows) {
        const url = `${APP_URL}${r.locale === 'pt' ? '' : '/' + r.locale}/l/${slug}`;
        const cover = r.cover_image_url ?? r.og_image_url;
        dynamicRoutes.push({
          url,
          lastModified: getSitemapDate(r.updated_at, now),
          changeFrequency: 'weekly',
          priority: 0.65,
          images: cover ? [cover] : undefined,
          alternates: { languages: langs },
        });
      }
    }
  } catch {
    return baseRoutes;
  }

  return [...baseRoutes, ...dynamicRoutes];
}
