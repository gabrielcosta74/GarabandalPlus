import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import { Metadata } from 'next';
import { getPilgrimagesAction } from './peregrinacoes/actions';
import { getFeaturedProducts } from './loja-online/actions';
import { APP_URL } from '../lib/config';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Apostolado de Garabandal',
  description: 'Santuário virtual do Apostolado de Garabandal. Peregrinações católicas, doações para a missão e vida de oração.',
  alternates: {
    canonical: `${APP_URL}/`,
  },
};

export default async function Page() {
  const meta = await loadMeta();
  const { data: pilgrimages } = await getPilgrimagesAction();
  const featuredProducts = await getFeaturedProducts();

  // Find the next upcoming pilgrimage (already sorted by date in action)
  const nextPilgrimage = pilgrimages && pilgrimages.length > 0 ? pilgrimages[0] : null;

  return <HomePageClient meta={meta} nextPilgrimage={nextPilgrimage} featuredProducts={featuredProducts} />;
}
