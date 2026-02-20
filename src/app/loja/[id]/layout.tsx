import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { supabaseServer } from '../../../lib/supabase';
import { buildProductPath } from '../../../lib/slug';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

const fetchProduct = async (param: string) => {
  if (!supabaseServer) return null;
  const rawId = decodeURIComponent(param);
  const candidates = new Set<string>([rawId]);
  if (rawId.includes('--')) {
    candidates.add(rawId.split('--')[0]);
  }
  if (rawId.includes('-')) {
    const parts = rawId.split('-');
    for (let i = parts.length - 1; i >= 1; i--) {
      candidates.add(parts.slice(0, i).join('-'));
    }
  }

  const { data } = await supabaseServer
    .from('store_products')
    .select('product_id, name, description, image_url, price, currency, stock, sku')
    .in('product_id', Array.from(candidates));

  if (!data || data.length === 0) return null;
  return data.reduce((best: any, current: any) => {
    if (!best) return current;
    return (current.product_id || '').length > (best.product_id || '').length ? current : best;
  }, null as any);
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const url = `${APP_URL}${buildProductPath(id, null)}`;
  const fallbackTitle = 'Produto | Garabandal +';
  const fallbackDescription = 'Produto oficial da loja do Apostolado de Garabandal.';

  if (!supabaseServer) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }

  try {
    const data = await fetchProduct(id);

    const title = data?.name ? `${data.name} | Garabandal +` : fallbackTitle;
    const description = data?.description || fallbackDescription;
    const canonicalPath = data?.product_id
      ? buildProductPath(data.product_id, data?.name)
      : buildProductPath(id, data?.name);

    return {
      title,
      description,
      alternates: { canonical: `${APP_URL}${canonicalPath}` },
      openGraph: {
        url: `${APP_URL}${canonicalPath}`,
        title,
        description,
        images: data?.image_url ? [data.image_url] : undefined,
      },
    };
  } catch {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }
}

export default async function LojaProdutoLayout({ children, params }: Props) {
  const { id } = await params;
  const product = await fetchProduct(id);

  if (!product) {
    return children;
  }

  const availability = typeof product.stock === 'number' && product.stock > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name || 'Produto',
    description: product.description || undefined,
    image: product.image_url ? [product.image_url] : undefined,
    sku: product.sku || undefined,
    offers: {
      '@type': 'Offer',
      price: product.price ?? 0,
      priceCurrency: product.currency || 'EUR',
      availability,
      url: product?.product_id
        ? `${APP_URL}${buildProductPath(product.product_id, product?.name || null)}`
        : `${APP_URL}${buildProductPath(id, product?.name || null)}`,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Início',
        item: `${APP_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Loja',
        item: `${APP_URL}/loja`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name || 'Produto',
        item: product?.product_id
          ? `${APP_URL}${buildProductPath(product.product_id, product?.name || null)}`
          : `${APP_URL}${buildProductPath(id, product?.name || null)}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
