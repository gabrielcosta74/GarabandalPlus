import type { Metadata } from 'next';
import { APP_URL } from '../../../../lib/config';
import { buildProductPath } from '../../../../lib/slug';
import { fetchProductForPage } from '../../../loja/[id]/page';
import { buildMerchantReturnPolicy, getPriceValidUntil } from '../../../../lib/product-schema';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

const getAbsoluteImageUrl = (image?: string | null) => {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${APP_URL}${image.startsWith('/') ? image : `/${image}`}`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductForPage(id, 'en');
  const canonicalPath = product?.id
    ? buildProductPath(product.id, product.name, 'en')
    : `/en/store/${id}`;
  const canonicalUrl = `${APP_URL}${canonicalPath}`;
  const ptPath = product?.id
    ? buildProductPath(product.id, (product as any).name_pt || product.name, 'pt')
    : `/loja/${id}`;

  const title = product?.name
    ? `${product.name} | Garabandal Apostolate Store`
    : 'Product | Garabandal Apostolate Store';
  const description = product?.description
    ? String(product.description).slice(0, 155)
    : 'Books, rosaries and devotional items from the Garabandal Apostolate online store.';
  const image = getAbsoluteImageUrl(product?.image) || `${APP_URL}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: canonicalUrl,
        'pt-PT': `${APP_URL}${ptPath}`,
        'pt-BR': `${APP_URL}${ptPath}`,
      },
    },
    openGraph: {
      url: canonicalUrl,
      title,
      description,
      type: 'website',
      locale: 'en_US',
      siteName: 'Garabandal Apostolate',
      images: [{ url: image, width: 800, height: 800, alt: product?.name || title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function EnglishStoreProductLayout({ children, params }: Props) {
  const { id } = await params;
  const product = await fetchProductForPage(id, 'en');

  if (!product) return children;

  const productUrl = `${APP_URL}${buildProductPath(product.id, product.name, 'en')}`;
  const availability =
    typeof product.stock === 'number' && product.stock <= 0
      ? 'https://schema.org/OutOfStock'
      : 'https://schema.org/InStock';
  const isBook = product.type_id?.includes('book');
  const isDigital = !product.isPhysical;

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    ...(isBook ? { additionalType: 'https://schema.org/Book' } : {}),
    name: product.name,
    description: product.description || undefined,
    image: product.image ? [getAbsoluteImageUrl(product.image)] : undefined,
    sku: product.sku || product.id,
    productID: product.id,
    url: productUrl,
    inLanguage: 'en',
    brand: {
      '@type': 'Organization',
      name: 'Garabandal Apostolate',
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: product.currency || 'EUR',
      price: Number(product.price || 0).toFixed(2),
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      priceValidUntil: getPriceValidUntil(),
      hasMerchantReturnPolicy: buildMerchantReturnPolicy(isDigital),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {children}
    </>
  );
}
