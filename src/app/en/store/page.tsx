import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { StorePageServer } from '../../loja/page';

export const metadata: Metadata = {
  title: 'Books on Garabandal | Garabandal Apostolate Bookstore',
  description: 'Official Garabandal Apostolate bookstore. Books on the apparitions of Our Lady of Garabandal, the visionaries (Conchita, Mari Loli, Jacinta, Mari Cruz) and the message of Garabandal.',
  keywords: [
    'books on Garabandal',
    'Garabandal apparitions book',
    'Conchita Garabandal book',
    'Our Lady of Garabandal book',
    'Marian books Catholic',
    'message of Garabandal book',
    'Garabandal Apostolate bookstore',
    'Catholic Marian books English',
    'Garabandal visionaries book',
  ],
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
    title: 'Books on Garabandal | Garabandal Apostolate',
    description: 'Books on the apparitions of Our Lady of Garabandal, the visionaries and the message of Garabandal.',
    type: 'website',
    locale: 'en_GB',
    siteName: 'Garabandal Apostolate',
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Books on Garabandal — Apostolate Bookstore' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Books on Garabandal — Apostolate Bookstore',
    description: 'Books on the apparitions, visionaries and message of Garabandal.',
    images: [`${APP_URL}/opengraph-image`],
  },
};

export default function EnglishStorePage() {
  return <StorePageServer locale="en" />;
}
