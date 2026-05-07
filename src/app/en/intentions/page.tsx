import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../../lib/seo';

export const metadata: Metadata = {
  title: 'Prayer Intentions to Our Lady of Garabandal',
  description: 'Send your prayer intentions to Our Lady of Garabandal. Light a virtual candle and entrust your prayers to the Sanctuary.',
  keywords: [
    'prayer intentions Garabandal',
    'send prayer Our Lady',
    'virtual candle Garabandal',
    'Catholic prayer request',
    'pray for me Catholic',
  ],
  alternates: {
    canonical: `${APP_URL}/en/intentions`,
    languages: {
      en: `${APP_URL}/en/intentions`,
      'pt-BR': `${APP_URL}/intencoes`,
      'pt-PT': `${APP_URL}/intencoes`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/intentions`,
    title: 'Prayer Intentions to Our Lady of Garabandal',
    description: 'Light a virtual candle and entrust your prayers to the Sanctuary of Garabandal.',
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Prayer Intentions — Garabandal Apostolate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prayer Intentions — Garabandal',
    description: 'Send your prayer intentions to Our Lady of Garabandal.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export { default } from '../../intencoes/page';
