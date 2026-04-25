import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { inferIsDigitalProduct } from '../../../../lib/product-kind';
import { inferRequestLocale } from '../../../../lib/locale-routing';
import { getStoreProductTypeText, localizeStoreProductText } from '../../../../lib/store-i18n';

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
    const locale = searchParams.get('locale') === 'en' ? 'en' : inferRequestLocale(request);

    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : 0;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

    const selectFields = [
      'product_id',
      'name',
      'name_en',
      'description',
      'description_en',
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
      const category = Array.isArray(categoryInfo)
        ? categoryInfo[0]?.name
        : categoryInfo?.name || productData.category || null;
      const isDigital = inferIsDigitalProduct({
        isPhysical: productData.is_physical,
        typeId: productData.type_id,
        category,
        name: productData.name,
        digitalUrl: productData.digital_url,
      });
      const isPhysical = !isDigital;

      const localizedProduct = localizeStoreProductText(productData, locale);
      const typeText = getStoreProductTypeText(isPhysical, locale);

      return {
        id: productData.product_id,
        name: localizedProduct.name,
        description: localizedProduct.description,
        category: localizeStoreProductText({ category, type_id: productData.type_id }, locale).category,
        categoryId: productData.category_id || null,
        price: Number(productData.price ?? 0),
        currency: productData.currency || 'EUR',
        image: productData.image_url || '/images/produto-placeholder.jpg',
        tag: typeText.tag,
        format: typeText.format,
        isPhysical,
        digitalUrl: productData.digital_url || null,
        stock: isPhysical && typeof productData.stock === 'number' ? productData.stock : null,
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
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err) {
    console.warn('Stock indisponível:', err);
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
