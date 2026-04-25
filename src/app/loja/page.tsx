import { APP_URL } from '../../lib/config';
import { type AppLocale } from '../../lib/locale-routing';
import { buildProductPath } from '../../lib/slug';
import { fetchStoreProductsForPage } from '../../lib/store-products';
import StorePageClient from './StorePageClient';

export const revalidate = 3600;

type StorePageServerProps = {
  locale: AppLocale;
};

const getAbsoluteImageUrl = (image?: string | null) => {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${APP_URL}${image.startsWith('/') ? image : `/${image}`}`;
};

export async function StorePageServer({ locale }: StorePageServerProps) {
  const products = await fetchStoreProductsForPage(locale);
  const storePath = locale === 'en' ? '/en/store' : '/loja';
  const storeName = locale === 'en' ? 'Garabandal Apostolate Online Store' : 'Loja Online do Apostolado de Garabandal';

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: storeName,
    url: `${APP_URL}${storePath}`,
    inLanguage: locale === 'en' ? 'en' : 'pt-BR',
    itemListElement: products.map((product, index) => {
      const productPath = buildProductPath(product.id, product.name, locale);
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: `${APP_URL}${productPath}`,
        item: {
          '@type': product.type_id?.includes('book') ? ['Product', 'Book'] : 'Product',
          name: product.name,
          description: product.description,
          image: getAbsoluteImageUrl(product.image),
          url: `${APP_URL}${productPath}`,
          offers: {
            '@type': 'Offer',
            price: Number(product.price || 0).toFixed(2),
            priceCurrency: product.currency || 'EUR',
            availability:
              product.isPhysical && typeof product.stock === 'number' && product.stock <= 0
                ? 'https://schema.org/OutOfStock'
                : 'https://schema.org/InStock',
          },
        },
      };
    }),
  };

  return (
    <>
      {products.length > 0 && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <StorePageClient initialProducts={products} initialLocale={locale} />
    </>
  );
}

export default function StorePage() {
  return <StorePageServer locale="pt" />;
}
