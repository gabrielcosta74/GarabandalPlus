import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from './peregrinacoes/actions';
import { getFeaturedProducts } from './loja-online/actions';
import { getHomeContent } from '../lib/cms/home';
import { getLatestVideos } from '../lib/youtube';
import { PUBLISHED_ONLY } from '../lib/content/preview';
import { APP_URL } from '../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../lib/seo';

const homeTitle = 'Garabandal: história, aparições e mensagens | Apostolado de Garabandal';
const homeDescription = 'Conheça Garabandal: a história dos acontecimentos de 1961–1965, as quatro videntes e as mensagens. Documentos, testemunhos e peregrinações do Apostolado.';

// The homepage is the page that has to rank, so it must be cacheable. This was
// dynamic purely so admins could preview drafts here; that now lives at
// /preview, which is session-gated and rendered per request. Leaving the
// homepage dynamic served it with `cache-control: no-store` and roughly
// tripled its TTFB against the ISR routes.
export const revalidate = 600;

export const metadata: Metadata = {
  title: {
    absolute: homeTitle,
  },
  description: homeDescription,
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    url: `${APP_URL}/`,
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
    description: homeDescription,
    images: [DEFAULT_OG_IMAGE],
  },
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
