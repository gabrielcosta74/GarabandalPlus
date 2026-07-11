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
  description: 'Site oficial da Associação do Apostolado de Garabandal, dedicado a divulgar a mensagem de Nossa Senhora em Garabandal através de peregrinações, oração e missão.',
  alternates: {
    canonical: `${APP_URL}/`,
    languages: {
      'x-default': `${APP_URL}/`,
      'pt-BR': `${APP_URL}/`,
      'pt-PT': `${APP_URL}/`,
      en: `${APP_URL}/en`,
      es: `${APP_URL}/es`,
      fr: `${APP_URL}/fr`,
      it: `${APP_URL}/it`,
    },
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
