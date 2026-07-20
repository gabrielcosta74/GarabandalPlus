import { notFound } from 'next/navigation';
import ProductDetailsClient from '../../../loja/[id]/ProductDetailsClient';
import { fetchProductForPage } from '../../../loja/[id]/page';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EnglishProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProductForPage(id, 'en');
  if (!product) notFound();
  return <ProductDetailsClient initialProduct={product} />;
}
