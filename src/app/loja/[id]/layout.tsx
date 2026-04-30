import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { supabaseServer } from '../../../lib/supabase';
import { buildProductPath } from '../../../lib/slug';
import { inferIsDigitalProduct } from '../../../lib/product-kind';
import { getPortugueseProductDescriptionFallback, localizeStoreProductText } from '../../../lib/store-i18n';
import { buildMerchantReturnPolicy, getPriceValidUntil } from '../../../lib/product-schema';

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
    .select('product_id, name, name_en, description, description_en, image_url, price, currency, stock, sku, category, type_id, metadata, specifications, is_active, is_physical, digital_url')
    .in('product_id', Array.from(candidates))
    .eq('is_active', true);

  if (!data || data.length === 0) return null;
  return data.reduce((best: any, current: any) => {
    if (!best) return current;
    return (current.product_id || '').length > (best.product_id || '').length ? current : best;
  }, null as any);
};

const isBookCategory = (category?: string, typeId?: string) => {
  const c = (category || '').toLowerCase();
  const t = (typeId || '').toLowerCase();
  return c.includes('livro') || t.includes('book');
};

const isDigitalCategory = (product: any) => {
  return inferIsDigitalProduct({
    isPhysical: product?.is_physical,
    typeId: product?.type_id,
    category: product?.category,
    name: product?.name,
    digitalUrl: product?.digital_url,
  });
};

const getAuthorSchema = (author?: string | null) => {
  const value = String(author || '').trim();
  if (!value) return null;

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const isOrganization =
    normalized.includes('apostolado') ||
    normalized.includes('associacao') ||
    normalized.includes('associação') ||
    normalized.includes('ministerio') ||
    normalized.includes('editora');

  return {
    '@type': isOrganization ? 'Organization' : 'Person',
    name: value,
  };
};

const truncateDescription = (value: string, maxLength = 155) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
};

const buildProductSeoDescription = (product: any, typePrefix: string, isBook: boolean, isDigital: boolean) => {
  const meta = product.metadata || {};
  const rawDescription = String(product.description || getPortugueseProductDescriptionFallback(product.name) || '').trim();
  const authorPart = meta.author ? ` de ${meta.author}` : '';
  const pagesPart = meta.pages ? `, ${meta.pages} páginas` : '';

  if (rawDescription) {
    const details = isBook ? ` Livro${authorPart}${pagesPart}.` : '';
    const delivery = isDigital ? ' Download digital após confirmação.' : ' Envio para Portugal e Brasil.';
    return truncateDescription(`${rawDescription}${details}${delivery}`);
  }

  return truncateDescription(
    `${typePrefix} do Apostolado de Garabandal${authorPart}. Conteúdo católico sobre Garabandal para formação espiritual e devoção mariana.`,
  );
};

const getProductAvailability = (product: any, isDigital: boolean) => {
  if (isDigital) return 'https://schema.org/InStock';
  if (typeof product.stock !== 'number') return 'https://schema.org/InStock';
  return product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
};

const getAbsoluteImageUrl = (image?: string | null) => {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${APP_URL}${image.startsWith('/') ? image : `/${image}`}`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const url = `${APP_URL}${buildProductPath(id, null)}`;
  const fallbackTitle = 'Artigo Religioso | Apostolado de Garabandal';
  const fallbackDescription = 'Artigo religioso da loja do Apostolado de Garabandal. Livros, terços e materiais espirituais para o Brasil e Portugal.';

  if (!supabaseServer) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }

  try {
    const data = await fetchProduct(id);
    const canonicalPath = data?.product_id
      ? buildProductPath(data.product_id, data?.name)
      : buildProductPath(id, data?.name);
    const canonicalUrl = `${APP_URL}${canonicalPath}`;

    if (!data) {
      return { title: fallbackTitle, description: fallbackDescription, alternates: { canonical: url } };
    }

    const isBook = isBookCategory(data.category, data.type_id);
    const isDigital = isDigitalCategory(data);
    const meta = data.metadata || {};

    // Build rich title
    const typePrefix = isBook && isDigital ? 'Livro Digital' : isBook ? 'Livro' : isDigital ? 'Produto Digital' : 'Artigo Religioso';
    const title = `${data.name} — ${typePrefix} | Apostolado de Garabandal`;

    // Build rich description using product fields
    const description = buildProductSeoDescription(data, typePrefix, isBook, isDigital);
    const englishName = localizeStoreProductText(data, 'en').name;

    // Build keywords
    const keywords: string[] = [
      data.name,
      `${data.name} comprar`,
      `${data.name} Brasil`,
      isBook ? `livro ${data.name}` : `artigo religioso ${data.name}`,
      isBook ? 'livros católicos Brasil' : 'artigos religiosos católicos',
      'loja católica online',
      'Apostolado de Garabandal',
      'Nossa Senhora de Garabandal',
    ];
    if (meta.author) {
      keywords.push(`livro ${meta.author}`);
      // Author-specific high-intent terms (e.g. "Conchita Garabandal livro")
      const authorFirstName = String(meta.author).split(' ')[0];
      keywords.push(`${authorFirstName} Garabandal livro`);
      keywords.push(`livro ${authorFirstName} Garabandal Brasil`);
    }
    if (isBook) keywords.push('livros sobre Garabandal', 'livros marianos Brasil');
    if (isBook && !isDigital) keywords.push('livro físico católico', 'comprar livro católico Brasil');
    if (isBook && isDigital) keywords.push('livro digital católico', 'ebook católico', 'download livro católico');

    const productImage = getAbsoluteImageUrl(data.image_url);
    const ogImages = productImage
      ? [{ url: productImage, width: 800, height: 800, alt: data.name }]
      : [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: title }];

    return {
      title,
      description,
      keywords,
      alternates: {
        canonical: canonicalUrl,
        languages: {
          'pt-BR': canonicalUrl,
          'pt-PT': canonicalUrl,
          en: `${APP_URL}${buildProductPath(data.product_id, englishName, 'en')}`,
        },
      },
      openGraph: {
        url: canonicalUrl,
        title,
        description,
        type: 'website',
        locale: 'pt_BR',
        siteName: 'Garabandal +',
        images: ogImages,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ogImages.map((i) => i.url),
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

  const isBook = isBookCategory(product.category, product.type_id);
  const isDigital = isDigitalCategory(product);
  const availability = getProductAvailability(product, isDigital);
  const meta = product.metadata || {};
  const productUrl = product?.product_id
    ? `${APP_URL}${buildProductPath(product.product_id, product?.name || null)}`
    : `${APP_URL}${buildProductPath(id, product?.name || null)}`;

  // additionalProperty for book-specific metadata (author, isbn, pages, publisher, cover_type, format)
  const additionalProperties = [];
  if (meta.author) additionalProperties.push({ '@type': 'PropertyValue', name: 'author', value: meta.author });
  if (meta.isbn) additionalProperties.push({ '@type': 'PropertyValue', name: 'isbn', value: meta.isbn });
  if (meta.pages) additionalProperties.push({ '@type': 'PropertyValue', name: 'numberOfPages', value: String(meta.pages) });
  if (meta.publisher) additionalProperties.push({ '@type': 'PropertyValue', name: 'publisher', value: meta.publisher });
  if (meta.cover_type) additionalProperties.push({ '@type': 'PropertyValue', name: 'bookFormat', value: meta.cover_type });
  if (meta.format) additionalProperties.push({ '@type': 'PropertyValue', name: 'encodingFormat', value: meta.format });

  const authorSchema = isBook ? getAuthorSchema(meta.author) : null;

  // bookFormat for Book schema (capa dura / capa mole / digital)
  const bookFormat = isBook
    ? isDigital
      ? 'https://schema.org/EBook'
      : meta.cover_type?.toLowerCase().includes('dura')
        ? 'https://schema.org/Hardcover'
        : 'https://schema.org/Paperback'
    : undefined;

  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    ...(isBook ? { additionalType: 'https://schema.org/Book' } : {}),
    name: product.name || 'Produto',
    description: product.description || getPortugueseProductDescriptionFallback(product.name) || undefined,
    image: product.image_url ? [getAbsoluteImageUrl(product.image_url)] : undefined,
    sku: product.sku || undefined,
    productID: product.product_id || product.sku || undefined,
    url: productUrl,
    category: product.category || undefined,
    inLanguage: 'pt-BR',
    brand: {
      '@type': 'Brand',
      name: 'Apostolado de Garabandal',
    },
    seller: {
      '@type': ['Organization', 'NGO'],
      name: 'Apostolado de Garabandal',
      url: APP_URL,
    },
    ...(additionalProperties.length > 0 ? { additionalProperty: additionalProperties } : {}),
    // Book-specific top-level fields for Google rich results
    ...(authorSchema ? { author: authorSchema } : {}),
    ...(isBook && meta.isbn ? { isbn: meta.isbn } : {}),
    ...(isBook && meta.publisher ? { publisher: { '@type': 'Organization', name: meta.publisher } } : {}),
    ...(isBook && meta.pages ? { numberOfPages: meta.pages } : {}),
    ...(bookFormat ? { bookFormat } : {}),
    offers: {
      '@type': 'Offer',
      url: productUrl,
      price: Number(product.price ?? 0).toFixed(2),
      priceCurrency: product.currency || 'EUR',
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      priceValidUntil: getPriceValidUntil(),
      hasMerchantReturnPolicy: buildMerchantReturnPolicy(isDigital),
      seller: {
        '@type': ['Organization', 'NGO'],
        name: 'Apostolado de Garabandal',
        url: APP_URL,
      },
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
