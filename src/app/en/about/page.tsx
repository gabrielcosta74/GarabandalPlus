import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../../lib/seo';

export const metadata: Metadata = {
  title: 'About the Garabandal Apostolate — Mission & History',
  description: 'Learn about the Garabandal Apostolate: over 16 years spreading the apparitions and messages of Our Lady of Mount Carmel of Garabandal.',
  keywords: [
    'Garabandal Apostolate history',
    'Marian apostolate mission',
    'Our Lady of Garabandal',
    'Catholic association Portugal',
    'Garabandal apparitions outreach',
    'Marian apostolate English',
  ],
  alternates: {
    canonical: `${APP_URL}/en/about`,
    languages: {
      en: `${APP_URL}/en/about`,
      'pt-BR': `${APP_URL}/sobre-nos`,
      'pt-PT': `${APP_URL}/sobre-nos`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/about`,
    title: 'About the Garabandal Apostolate — Mission & History',
    description: 'Over 16 years spreading the messages of Our Lady of Garabandal across Portugal, Brazil and the world.',
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'About the Garabandal Apostolate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About the Garabandal Apostolate',
    description: 'Mission and history of the Garabandal Apostolate.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export { default } from '../../sobre-nos/page';
