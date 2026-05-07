import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../../lib/seo';

export const metadata: Metadata = {
  title: 'Garabandal Pilgrimage 2026 — Catholic Marian Tours from Spain & Portugal',
  description: 'Join an organised Catholic Marian pilgrimage to Garabandal in 2026. Small groups, full spiritual programme, accommodation and transport. Official Garabandal Apostolate.',
  keywords: [
    'Garabandal pilgrimage 2026',
    'pilgrimage to Garabandal',
    'Catholic Marian pilgrimage',
    'Our Lady of Garabandal pilgrimage',
    'Garabandal Apostolate pilgrimages',
    'Catholic pilgrimage Spain 2026',
    'Marian pilgrimage Portugal Spain',
    'organised Catholic pilgrimage Europe',
    'Garabandal Cantabria pilgrimage',
    'Fatima Garabandal pilgrimage',
    'Catholic spiritual tour 2026',
  ],
  alternates: {
    canonical: `${APP_URL}/en/pilgrimages`,
    languages: {
      en: `${APP_URL}/en/pilgrimages`,
      'pt-BR': `${APP_URL}/peregrinacoes`,
      'pt-PT': `${APP_URL}/peregrinacoes`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/pilgrimages`,
    title: 'Garabandal Pilgrimage 2026 | Catholic Marian Tours',
    description: 'Organised Catholic Marian pilgrimages to Garabandal. Small groups, full spiritual programme. Official Garabandal Apostolate.',
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Garabandal Pilgrimage 2026 — Garabandal Apostolate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Garabandal Pilgrimage 2026 | Catholic Marian Tours',
    description: 'Organised Catholic Marian pilgrimages to Garabandal. Official Garabandal Apostolate.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export { default } from '../../peregrinacoes/page';
