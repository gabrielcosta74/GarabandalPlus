import type { MetadataRoute } from 'next';
import { APP_URL } from '../lib/config';
import { supabaseServer } from '../lib/supabase';
import { buildProductPath } from '../lib/slug';

export const revalidate = 3600;

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
    const { data: products } = await supabaseServer
      .from('store_products')
      .select('product_id, name')
      .eq('is_active', true);

    (products || []).forEach((product: any) => {
      if (product?.product_id) {
        dynamicRoutes.push({
          url: `${APP_URL}${buildProductPath(product.product_id, product.name)}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.75,
        });
      }
    });

    const statusEnv = process.env.NEXT_PUBLIC_PILGRIMAGE_STATUSES;
    const statusFilter = statusEnv
      ? statusEnv.split(',').map((s) => s.trim()).filter(Boolean)
      : ['open', 'waitlist', 'active', 'ativo'];

    let pilgrimagesQuery = supabaseServer
      .from('pilgrimages')
      .select('slug, status')
      .order('start_date', { ascending: true });

    if (statusFilter.length > 0) {
      pilgrimagesQuery = pilgrimagesQuery.in('status', statusFilter);
    }

    const { data: pilgrimages } = await pilgrimagesQuery;

    (pilgrimages || []).forEach((pilgrimage: any) => {
      if (pilgrimage?.slug) {
        dynamicRoutes.push({
          url: `${APP_URL}/peregrinacoes/${pilgrimage.slug}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.9,
        });
      }
    });
  } catch {
    return baseRoutes;
  }

  return [...baseRoutes, ...dynamicRoutes];
}
