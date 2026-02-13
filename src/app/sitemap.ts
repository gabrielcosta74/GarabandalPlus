import type { MetadataRoute } from 'next';
import { APP_URL } from '../lib/config';
import { supabaseServer } from '../lib/supabase';
import { buildProductPath } from '../lib/slug';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: `${APP_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${APP_URL}/peregrinacoes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${APP_URL}/donations`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${APP_URL}/loja`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${APP_URL}/tornar-membro`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${APP_URL}/intencoes`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/transparencia`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${APP_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${APP_URL}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
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
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
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
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    });
  } catch {
    return baseRoutes;
  }

  return [...baseRoutes, ...dynamicRoutes];
}
