import { supabaseServer } from './supabase';
import { type AppLocale } from './locale-routing';
import { inferIsDigitalProduct } from './product-kind';
import { getStoreProductTypeText, localizeStoreProductText } from './store-i18n';

export type StoreProductView = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  tag?: string;
  category?: string | null;
  description: string;
  format: string;
  isPhysical: boolean;
  digitalUrl?: string | null;
  stock?: number | null;
  allowedCountries?: string[] | null;
  taxRate?: number;
  specifications?: Record<string, unknown>;
  variants?: unknown[];
  categoryId?: string | null;
  type_id?: string;
  metadata?: Record<string, unknown>;
};

export type StoreProductSitemapRecord = {
  product_id: string;
  name: string | null;
  name_en?: string | null;
  image_url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const STORE_PRODUCT_SELECT_FIELDS = [
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
  'category_info:categories(name)',
].join(', ');

export const mapStoreProductRecord = (
  productData: Record<string, any>,
  locale: AppLocale,
): StoreProductView => {
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
  const localizedProduct = localizeStoreProductText({ ...productData, category }, locale);
  const typeText = getStoreProductTypeText(isPhysical, locale);

  return {
    id: productData.product_id,
    name: localizedProduct.name,
    description: localizedProduct.description,
    category: localizedProduct.category,
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
};

export async function fetchStoreProductsForPage(locale: AppLocale): Promise<StoreProductView[]> {
  if (!supabaseServer) return [];

  const { data, error } = await supabaseServer
    .from('store_products')
    .select(STORE_PRODUCT_SELECT_FIELDS)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data) {
    if (error) console.warn('Erro ao carregar produtos da loja para SEO:', error);
    return [];
  }

  return data.map((product) => mapStoreProductRecord(product as Record<string, any>, locale));
}

