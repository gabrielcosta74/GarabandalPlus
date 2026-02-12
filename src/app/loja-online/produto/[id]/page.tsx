import { redirect } from 'next/navigation';
import { buildProductPath } from '../../../../lib/slug';

interface Props {
  params: { id: string };
}

export default function ProductPage({ params }: Props) {
  redirect(buildProductPath(params.id, null));
}
