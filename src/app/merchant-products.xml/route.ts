import { APP_URL } from '../../lib/config';
import { inferIsDigitalProduct } from '../../lib/product-kind';
import { buildProductPath } from '../../lib/slug';
import { supabaseServer } from '../../lib/supabase';
import {
  getAdditionalProductImageUrls,
  getMerchantProductDescription,
  getMerchantProductTitle,
  toAbsoluteStoreImageUrl,
} from '../../lib/store-merchandising';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProductRow = {
  product_id: string;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  currency?: string | null;
  stock?: number | null;
  is_physical?: boolean | null;
  type_id?: string | null;
  metadata?: Record<string, unknown> | null;
  image_url?: string | null;
  digital_url?: string | null;
  allowed_countries?: string[] | null;
};

const xmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeUrl = (url?: string | null) => {
  if (!url) return `${APP_URL}/images/produto-placeholder.jpg`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${APP_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

const getMetadataText = (metadata: ProductRow['metadata'], keys: string[]) => {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
};

const getNumericIdentifier = (metadata: ProductRow['metadata'], keys: string[]) => {
  const value = getMetadataText(metadata, keys);
  const numeric = value?.replace(/[^\d]/g, '') || '';
  return numeric || null;
};

const getDescription = (product: ProductRow) => {
  const description = getMerchantProductDescription(product.product_id, product.description);
  if (description) return description;
  return `Produto da loja do Apostolado de Garabandal: ${product.name || product.product_id}.`;
};

const getMerchantImageUrl = (productId: string) =>
  `${APP_URL}/merchant-images/${encodeURIComponent(productId)}`;

const getShippingCountries = (product: ProductRow, isDigital: boolean) => {
  if (isDigital) return ['PT', 'BR'];
  const allowed = Array.isArray(product.allowed_countries)
    ? product.allowed_countries.map((country) => country.trim().toUpperCase()).filter(Boolean)
    : [];
  const countries = allowed.length > 0 ? allowed : ['PT', 'BR'];
  return countries.filter((country) => country === 'PT' || country === 'BR');
};

const buildShippingXml = (product: ProductRow, isDigital: boolean, currency: string) =>
  getShippingCountries(product, isDigital)
    .map(
      (country) => `
      <g:shipping>
        <g:country>${xmlEscape(country)}</g:country>
        <g:service>${isDigital ? 'Digital delivery' : 'Standard'}</g:service>
        <g:price>0.00 ${xmlEscape(currency)}</g:price>
      </g:shipping>`,
    )
    .join('');

const buildProductItemXml = (product: ProductRow) => {
  const metadata = product.metadata || {};
  const isDigital = inferIsDigitalProduct({
    isPhysical: product.is_physical,
    typeId: product.type_id,
    category: product.category,
    name: product.name,
    digitalUrl: product.digital_url,
  });
  const isPhysical = !isDigital;
  const currency = product.currency || 'EUR';
  const price = Number(product.price ?? 0);
  const link = `${APP_URL}${buildProductPath(product.product_id, product.name || null)}`;
  const availability = isPhysical && typeof product.stock === 'number' && product.stock <= 0 ? 'out_of_stock' : 'in_stock';
  const isbn = getMetadataText(metadata, ['isbn']);
  const isbnAsGtin = isbn?.replace(/[^\d]/g, '') || null;
  const gtin =
    getNumericIdentifier(metadata, ['gtin', 'gtin13', 'gtin14', 'gtin12', 'gtin8']) ||
    (isbnAsGtin?.length === 13 ? isbnAsGtin : null);
  const mpn = getMetadataText(metadata, ['mpn', 'manufacturer_part_number']) || product.sku || product.product_id;
  const hasIdentifier = Boolean(gtin || isbn || mpn);
  const additionalImages = getAdditionalProductImageUrls(
    product.product_id,
    metadata,
    product.image_url,
  )
    .map((url) => toAbsoluteStoreImageUrl(url, APP_URL))
    .map((url) => `<g:additional_image_link>${xmlEscape(url)}</g:additional_image_link>`)
    .join('\n      ');

  return `
    <item>
      <g:id>${xmlEscape(product.product_id)}</g:id>
      <g:title>${xmlEscape(getMerchantProductTitle(product.product_id, product.name || product.product_id))}</g:title>
      <g:description>${xmlEscape(getDescription(product))}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(product.image_url ? getMerchantImageUrl(product.product_id) : normalizeUrl(null))}</g:image_link>
      ${additionalImages}
      <g:availability>${availability}</g:availability>
      <g:price>${price.toFixed(2)} ${xmlEscape(currency)}</g:price>
      <g:condition>new</g:condition>
      <g:brand>Apostolado de Garabandal</g:brand>
      ${gtin ? `<g:gtin>${xmlEscape(gtin)}</g:gtin>` : ''}
      ${mpn ? `<g:mpn>${xmlEscape(mpn)}</g:mpn>` : ''}
      <g:identifier_exists>${hasIdentifier ? 'yes' : 'no'}</g:identifier_exists>
      ${product.category ? `<g:product_type>${xmlEscape(product.category)}</g:product_type>` : ''}
      ${buildShippingXml(product, isDigital, currency)}
    </item>`;
};

export async function GET() {
  if (!supabaseServer) {
    return new Response('Database unavailable', { status: 500 });
  }

  const { data, error } = await supabaseServer
    .from('store_products')
    .select('product_id, sku, name, description, category, price, currency, stock, is_physical, type_id, metadata, image_url, digital_url, allowed_countries')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Merchant feed error:', error);
    return new Response('Merchant feed unavailable', { status: 500 });
  }

  const items = ((data || []) as ProductRow[]).map(buildProductItemXml).join('');
  const updated = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Apostolado de Garabandal - Loja</title>
    <link>${xmlEscape(`${APP_URL}/loja`)}</link>
    <description>Produtos da loja online do Apostolado de Garabandal</description>
    <lastBuildDate>${xmlEscape(updated)}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': 'inline; filename="merchant-products.xml"',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
