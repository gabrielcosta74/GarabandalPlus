import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import { Metadata } from 'next';
import { getPilgrimagesAction } from './peregrinacoes/actions';
import { getFeaturedProducts } from './loja-online/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Início',
  description: 'Bem-vindo ao Santuário Virtual de Garabandal. Envie as suas intenções, faça parte da comunidade e apoie a nossa missão de evangelização.',
};

export default async function Page() {
  const meta = await loadMeta();
  const { data: pilgrimages } = await getPilgrimagesAction();
  const featuredProducts = await getFeaturedProducts();

  // Find the next upcoming pilgrimage (already sorted by date in action)
  const nextPilgrimage = pilgrimages && pilgrimages.length > 0 ? pilgrimages[0] : null;

  return <HomePageClient meta={meta} nextPilgrimage={nextPilgrimage} featuredProducts={featuredProducts} />;
}
