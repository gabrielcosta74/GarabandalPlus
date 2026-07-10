import { supabaseServer } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteProps = {
  params: Promise<{ id: string }>;
};

const getProductId = (param: string) => decodeURIComponent(param).replace(/\.(?:jpe?g|png|webp)$/i, '');

export async function GET(_request: Request, { params }: RouteProps) {
  if (!supabaseServer) return new Response('Image unavailable', { status: 503 });

  const { id } = await params;
  const productId = getProductId(id);
  const { data, error } = await supabaseServer
    .from('store_products')
    .select('image_url')
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data?.image_url || !/^https?:\/\//i.test(data.image_url)) {
    return new Response('Image not found', { status: 404 });
  }

  const source = await fetch(data.image_url, { cache: 'no-store' });
  const contentType = source.headers.get('content-type') || '';
  if (!source.ok || !source.body || !contentType.startsWith('image/')) {
    return new Response('Image unavailable', { status: 502 });
  }

  return new Response(source.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'index, follow, max-image-preview:large',
    },
  });
}
