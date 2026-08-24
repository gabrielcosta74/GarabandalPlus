import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from './peregrinacoes/actions';
import { getFeaturedProducts } from './loja-online/actions';
import { getHomeContent } from '../lib/cms/home';
import { getLatestVideos } from '../lib/youtube';
import { PUBLISHED_ONLY } from '../lib/content/preview';
import { APP_URL } from '../lib/config';

// The homepage is the page that has to rank, so it must be cacheable. This was
// dynamic purely so admins could preview drafts here; that now lives at
// /preview, which is session-gated and rendered per request. Leaving the
// homepage dynamic served it with `cache-control: no-store` and roughly
// tripled its TTFB against the ISR routes.
export const revalidate = 600;

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
  const homeContent = await getHomeContent('pt', PUBLISHED_ONLY);
  const lives = await getLatestVideos(4);

  // The complete list remains on /peregrinacoes; the homepage only needs the
  // first four, already sorted by start_date ascending.
  const upcomingPilgrimages = (pilgrimages || []).slice(0, 4);

  return <HomePageClient meta={meta} pilgrimages={upcomingPilgrimages} featuredProducts={featuredProducts} homeContent={homeContent} lives={lives} locale="pt" />;
}
