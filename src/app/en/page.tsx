import { loadMeta } from '../../lib/donations';
import HomePageClient from '../../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from '../peregrinacoes/actions';
import { getFeaturedProducts } from '../loja-online/actions';
import { APP_URL } from '../../lib/config';

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: 'Garabandal+ | The Garabandal Apostolate App',
  },
  description: 'Virtual sanctuary of the Garabandal Apostolate. Catholic pilgrimages, mission donations and a life of prayer.',
  alternates: {
    canonical: `${APP_URL}/en`,
  },
};

export default async function EnHomePage() {
  const meta = await loadMeta();
  const { data: pilgrimages } = await getPilgrimagesAction();
  const featuredProducts = await getFeaturedProducts();
  const upcomingPilgrimages = pilgrimages || [];

  return <HomePageClient meta={meta} pilgrimages={upcomingPilgrimages} featuredProducts={featuredProducts} />;
}
