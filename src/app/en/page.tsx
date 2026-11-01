import { loadMeta } from '../../lib/donations';
import HomePageClient from '../../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from '../peregrinacoes/actions';
import { getFeaturedProducts } from '../loja-online/actions';
import { getHomeContent } from '../../lib/cms/home';
import { getLatestVideos } from '../../lib/youtube';
import { PUBLISHED_ONLY } from '../../lib/content/preview';
import { APP_URL } from '../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';

const homeTitle = 'Garabandal: history, apparitions and messages | Garabandal Apostolate';
const homeDescription = 'Explore Garabandal: the events of 1961–1965, the four seers and the messages. Historical documents, testimonies and pilgrimages from the Garabandal Apostolate.';

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
  keywords: [
    'Garabandal Apostolate',
    'Garabandal official website',
    'Garabandal pilgrimage',
    'Catholic Marian pilgrimage',
    'Our Lady of Garabandal',
    'Catholic donations Garabandal',
    'Garabandal membership',
    'Catholic store Garabandal',
    'Marian apostolate',
  ],
  alternates: {
    canonical: `${APP_URL}/en`,
    languages: {
      'x-default': `${APP_URL}/`,
      en: `${APP_URL}/en`,
      'pt-BR': `${APP_URL}/`,
      'pt-PT': `${APP_URL}/`,
      es: `${APP_URL}/es`,
      fr: `${APP_URL}/fr`,
      it: `${APP_URL}/it`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en`,
    title: homeTitle,
    description: homeDescription,
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Garabandal Apostolate — Official Site' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
    description: homeDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function EnHomePage() {
  const meta = await loadMeta();
  const { data: pilgrimages } = await getPilgrimagesAction();
  const featuredProducts = await getFeaturedProducts();
  const homeContent = await getHomeContent('en', PUBLISHED_ONLY);
  const lives = await getLatestVideos(4);
  const upcomingPilgrimages = (pilgrimages || []).slice(0, 4);

  return <HomePageClient meta={meta} pilgrimages={upcomingPilgrimages} featuredProducts={featuredProducts} homeContent={homeContent} lives={lives} locale="en" />;
}
