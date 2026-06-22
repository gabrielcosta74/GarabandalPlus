import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from './peregrinacoes/actions';
import { getFeaturedProducts } from './loja-online/actions';
import { getHomeContent } from '../lib/cms/home';
import { getLatestVideos } from '../lib/youtube';
import { getPublicStatuses } from '../lib/content/preview';
import { APP_URL } from '../lib/config';

// Dynamic so the homepage is preview-aware (admins see draft devotional
// content pre-cutover). Revisit caching strategy at cutover if needed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    absolute: 'Apostolado de Garabandal — Aparições, mensagens e peregrinações',
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
  const homeContent = await getHomeContent('pt', await getPublicStatuses());
  const lives = await getLatestVideos(9);

  // Pass all upcoming pilgrimages to display different statuses (open, full, waitlist)
  // getPilgrimagesAction already returns them sorted by start_date ascending
  const upcomingPilgrimages = pilgrimages || [];

  return <HomePageClient meta={meta} pilgrimages={upcomingPilgrimages} featuredProducts={featuredProducts} homeContent={homeContent} lives={lives} locale="pt" />;
}
