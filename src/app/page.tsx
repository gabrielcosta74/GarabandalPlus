import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from './peregrinacoes/actions';
import { getFeaturedProducts } from './loja-online/actions';
import { APP_URL } from '../lib/config';

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: 'Garabandal+ | A App do Apostolado de Garabandal',
  },
  description: 'Santuário virtual do Apostolado de Garabandal. Peregrinações católicas, doações para a missão e vida de oração.',
  alternates: {
    canonical: `${APP_URL}/`,
  },
};

export default async function Page() {
  const meta = await loadMeta();
  const { data: pilgrimages } = await getPilgrimagesAction();
  const featuredProducts = await getFeaturedProducts();

  // Pass all upcoming pilgrimages to display different statuses (open, full, waitlist)
  // getPilgrimagesAction already returns them sorted by start_date ascending
  const upcomingPilgrimages = pilgrimages || [];

  return <HomePageClient meta={meta} pilgrimages={upcomingPilgrimages} featuredProducts={featuredProducts} />;
}
