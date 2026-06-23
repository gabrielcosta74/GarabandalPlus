import { loadMeta } from '../../lib/donations';
import HomePageClient from '../../components/home/HomePageClient';
import type { Metadata } from 'next';
import { getPilgrimagesAction } from '../peregrinacoes/actions';
import { getFeaturedProducts } from '../loja-online/actions';
import { getHomeContent } from '../../lib/cms/home';
import { getLatestVideos } from '../../lib/youtube';
import { getPublicStatuses } from '../../lib/content/preview';
import { APP_URL } from '../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';

// Dynamic so the homepage is preview-aware (admins see draft content pre-cutover).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    absolute: 'Garabandal Apostolate — Marian Apparitions & Pilgrimages',
  },
  description: 'Official platform of the Garabandal Apostolate. Book Catholic Marian pilgrimages to Garabandal, support the mission, become a member and shop the Catholic store.',
  keywords: [
    'Garabandal Apostolate',
    'Garabandal official website',
    'Garabandal pilgrimage 2026',
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
      en: `${APP_URL}/en`,
      'pt-BR': `${APP_URL}/`,
      'pt-PT': `${APP_URL}/`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en`,
    title: 'Garabandal Apostolate — Official Site',
    description: 'Catholic Marian pilgrimages to Garabandal, donations, membership and Catholic store. Official Garabandal Apostolate.',
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Garabandal Apostolate — Official Site' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Garabandal Apostolate — Official Site',
    description: 'Catholic Marian pilgrimages, donations, membership and Catholic store.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function EnHomePage() {
  const meta = await loadMeta();
  const { data: pilgrimages } = await getPilgrimagesAction();
  const featuredProducts = await getFeaturedProducts();
  const homeContent = await getHomeContent('en', await getPublicStatuses());
  const lives = await getLatestVideos(9);
  const upcomingPilgrimages = pilgrimages || [];

  return <HomePageClient meta={meta} pilgrimages={upcomingPilgrimages} featuredProducts={featuredProducts} homeContent={homeContent} lives={lives} locale="en" />;
}
