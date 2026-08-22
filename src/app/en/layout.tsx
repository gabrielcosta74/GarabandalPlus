import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: {
    template: '%s | Garabandal Apostolate',
    default: 'Garabandal Apostolate',
  },
  description: 'Official platform of the Garabandal Apostolate. Catholic Marian pilgrimages, donations, membership and Catholic store.',
  keywords: [
    'Garabandal Apostolate',
    'Garabandal official website',
    'Catholic pilgrimage Garabandal',
    'Our Lady of Garabandal',
    'Marian pilgrimage Spain',
    'Catholic donations',
    'Catholic membership',
    'Catholic store',
    'Our Lady of Mount Carmel of Garabandal',
  ],
  alternates: {
    canonical: `${APP_URL}/en`,
    languages: {
      en: `${APP_URL}/en`,
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: `${APP_URL}/en`,
    siteName: SITE_NAME,
    title: 'Garabandal Apostolate',
    description: 'Catholic Marian pilgrimages, donations, membership and Catholic store. Official Garabandal Apostolate.',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Garabandal Apostolate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Garabandal Apostolate',
    description: 'Catholic Marian pilgrimages, donations, membership and Catholic store.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  // The root layout declares lang="pt-BR" and stays static (reading the
  // pathname there would make every route on the site dynamic). Re-declare
  // the language for this subtree instead — the HTML spec resolves `lang`
  // against the nearest ancestor that sets it.
  return <div lang="en">{children}</div>;
}
