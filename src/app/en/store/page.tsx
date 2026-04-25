import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { StorePageServer } from '../../loja/page';

export const metadata: Metadata = {
  title: 'Online Catholic Store | Garabandal Apostolate',
  description: 'Find books, rosaries, devotional items and formation materials from the Garabandal Apostolate.',
  alternates: {
    canonical: `${APP_URL}/en/store`,
    languages: {
      en: `${APP_URL}/en/store`,
      'pt-PT': `${APP_URL}/loja`,
      'pt-BR': `${APP_URL}/loja`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/store`,
    title: 'Online Catholic Store | Garabandal Apostolate',
    description: 'Books, rosaries, devotional items and formation materials from the Garabandal Apostolate.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Garabandal Apostolate',
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Garabandal Apostolate Store' }],
  },
};

export default function EnglishStorePage() {
  return <StorePageServer locale="en" />;
}
