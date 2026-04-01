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
    .select('product_id, name, description, image_url, price, currency, stock, sku, category, type_id, metadata, specifications, is_active')
    .in('product_id', Array.from(candidates));

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

const isDigitalCategory = (category?: string, typeId?: string) => {
  const c = (category || '').toLowerCase();
  const t = (typeId || '').toLowerCase();
  return t.includes('digital') || c.includes('digital') || t.includes('pdf') || t.includes('ebook');
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
    const isDigital = isDigitalCategory(data.category, data.type_id);
    const meta = data.metadata || {};

    // Build rich title
    const typePrefix = isBook && isDigital ? 'Livro Digital' : isBook ? 'Livro' : isDigital ? 'Produto Digital' : 'Artigo Religioso';
    const title = `${data.name} — ${typePrefix} | Apostolado de Garabandal`;

    // Build rich description using product fields
    const authorPart = meta.author ? ` de ${meta.author}` : '';
    const pagesPart = meta.pages ? `, ${meta.pages} páginas` : '';
    const rawDesc = data.description || '';
    const shortDesc = rawDesc.length > 100 ? rawDesc.slice(0, 100) + '…' : rawDesc;
    const description = data.description
      ? `${shortDesc} ${isBook ? `Livro${authorPart}${pagesPart}.` : ''} Apostolado de Garabandal — entrega para o Brasil e Portugal.`.trim()
      : `${typePrefix} do Apostolado de Garabandal${authorPart}. Artigos religiosos e espirituais para católicos no Brasil e em Portugal.`;

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

    const ogImages = data.image_url
      ? [{ url: data.image_url, width: 800, height: 800, alt: data.name }]
      : [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: title }];

    return {
      title,
      description,
      keywords,
      alternates: {
        canonical: canonicalUrl,
        languages: { 'pt-BR': canonicalUrl, 'pt-PT': canonicalUrl },
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

  const availability = typeof product.stock === 'number' && product.stock > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  const isBook = isBookCategory(product.category, product.type_id);
  const isDigital = isDigitalCategory(product.category, product.type_id);
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

  // book_digital → ['Product','Book'], book_physical → ['Product','Book'], other → 'Product'
  const schemaType = isBook ? ['Product', 'Book'] : 'Product';

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
    '@type': schemaType,
    name: product.name || 'Produto',
    description: product.description || undefined,
    image: product.image_url ? [product.image_url] : undefined,
    sku: product.sku || undefined,
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
      price: product.price ?? 0,
      priceCurrency: product.currency || 'EUR',
      availability,
      url: productUrl,
      seller: {
        '@type': ['Organization', 'NGO'],
        name: 'Apostolado de Garabandal',
        url: APP_URL,
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: [
          { '@type': 'DefinedRegion', addressCountry: 'BR' },
          { '@type': 'DefinedRegion', addressCountry: 'PT' },
        ],
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
