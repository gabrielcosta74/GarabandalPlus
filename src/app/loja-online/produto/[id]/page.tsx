import { Metadata } from 'next';
import ProductClient from './ProductClient';
import { getProduct, getRelatedProducts } from '../../lib';

// Force dynamic because we are fetching specific product data that changes or stock changes
export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id);

  if (!product) {
    return {
      title: 'Produto não encontrado | Loja Garabandal',
    };
  }

  return {
    title: product.name,
    description: product.description || `Adquira ${product.name} na Loja Oficial do Apostolado de Garabandal.`,
    openGraph: {
      title: product.name,
      description: product.description || `Detalhes do produto ${product.name}.`,
      images: [
        {
          url: product.image?.startsWith('/')
            ? `https://app.apostoladodegarabandal.com${product.image}`
            : product.image || '/images/og-image.jpg',
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
      type: 'website', // or 'product' but that's complex to structure perfectly without more data
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.id);
  // Fetch related products only if we have a main product
  const related = product ? await getRelatedProducts(product.id, product.category) : [];

  return <ProductClient product={product} relatedProducts={related} />;
}
