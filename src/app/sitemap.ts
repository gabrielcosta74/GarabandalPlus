import type { MetadataRoute } from 'next';
import { APP_URL } from '../lib/config';
import { supabaseServer } from '../lib/supabase';
import { buildProductPath } from '../lib/slug';
import { getPilgrimageSeoImages } from '../lib/seo';
import { localizeStoreProductText } from '../lib/store-i18n';
import { type StoreProductSitemapRecord } from '../lib/store-products';

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
    .select('product_id, name, name_en, image_url')
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
    },
    {
      url: `${APP_URL}/donations`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
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
    },
    {
      url: `${APP_URL}/en/donations`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
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
  } catch {
    return baseRoutes;
  }

  return [...baseRoutes, ...dynamicRoutes];
}
