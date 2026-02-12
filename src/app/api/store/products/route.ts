import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 0;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ products: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
    const rawOffset = Number(searchParams.get('offset') ?? 0);
    const includeVariants = searchParams.get('includeVariants') !== '0';

    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : 0;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

    const selectFields = [
      'product_id',
      'name',
      'description',
      'category_id',
      'category',
      'price',
      'currency',
      'stock',
      'is_active',
      'is_physical',
      'type_id',
      'metadata',
      'image_url',
      'digital_url',
      'allowed_countries',
      'tax_rate',
      'specifications',
      includeVariants ? 'variants:product_variants(*)' : null,
      'category_info:categories(name)',
    ].filter(Boolean).join(', ');

    let query = supabaseServer
      .from('store_products')
      .select(selectFields)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (limit > 0) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Erro ao carregar stock:', error);
      return NextResponse.json({ products: [] });
    }

    const products = (data || []).map((product) => {
      const productData = product as any;
      const categoryInfo = productData.category_info;

      return {
        id: productData.product_id,
        name: productData.name || 'Produto',
        description: productData.description || '',
        category: Array.isArray(categoryInfo) ? categoryInfo[0]?.name : categoryInfo?.name || productData.category || null,
        categoryId: productData.category_id || null,
        price: Number(productData.price ?? 0),
        currency: productData.currency || 'EUR',
        image: productData.image_url || '/images/produto-placeholder.jpg',
        tag: productData.is_physical ? 'Fisico' : 'Digital',
        format: productData.is_physical ? 'Produto físico' : 'PDF digital',
        isPhysical: productData.is_physical ?? true,
        digitalUrl: productData.digital_url || null,
        stock: typeof productData.stock === 'number' ? productData.stock : null,
        allowedCountries: productData.allowed_countries || [],
        taxRate: productData.tax_rate ?? 0.23,
        specifications: productData.specifications || {},
        variants: productData.variants || [],
        type_id: productData.type_id,
        metadata: productData.metadata || {},
      };
    });

    return NextResponse.json({ products }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      }
    });
  } catch (err) {
    console.warn('Stock indisponível:', err);
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
