import { redirect } from 'next/navigation';
import { buildProductPath } from '../../../../lib/slug';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  redirect(buildProductPath(id, null));
}
