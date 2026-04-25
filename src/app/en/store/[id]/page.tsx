import ProductDetailsClient from '../../../loja/[id]/ProductDetailsClient';
import { fetchProductForPage } from '../../../loja/[id]/page';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EnglishProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProductForPage(id, 'en');
  return <ProductDetailsClient initialProduct={product} />;
}
