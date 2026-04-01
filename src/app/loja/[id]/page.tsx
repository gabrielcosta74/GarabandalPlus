import { supabaseServer } from '../../../lib/supabase';
import ProductDetailsClient from './ProductDetailsClient';

type Props = {
  params: Promise<{ id: string }>;
};

// Fetch product server-side so Googlebot sees the content in HTML
const fetchProductForPage = async (param: string) => {
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

  try {
    const { data } = await supabaseServer
      .from('store_products')
      .select(
        'product_id, name, description, category_id, category, price, currency, stock, is_active, is_physical, type_id, metadata, image_url, digital_url, allowed_countries, tax_rate, specifications, variants:product_variants(*)',
      )
      .in('product_id', Array.from(candidates))
      .eq('is_active', true);

    if (!data || data.length === 0) return null;
    const best = data.reduce((b: any, c: any) => {
      if (!b) return c;
      return (c.product_id || '').length > (b.product_id || '').length ? c : b;
    }, null as any);

    // Normalise to match Product type expected by client component
    return {
      ...best,
      id: best.product_id,
      image: best.image_url,
      isPhysical: best.is_physical,
      allowedCountries: best.allowed_countries || [],
      taxRate: best.tax_rate,
      digitalUrl: best.digital_url,
      variants: best.variants || [],
      type: best.type_id,
    };
  } catch {
    return null;
  }
};

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProductForPage(id);
  return <ProductDetailsClient initialProduct={product} />;
}
