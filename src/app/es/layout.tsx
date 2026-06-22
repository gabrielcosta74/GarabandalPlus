import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: {
    template: '%s | Apostolado de Garabandal',
    default: 'Apostolado de Garabandal',
  },
  description: 'Plataforma oficial del Apostolado de Garabandal. Peregrinaciones marianas católicas, donaciones, membresía y tienda católica.',
  keywords: [
    'Apostolado de Garabandal',
    'Garabandal sitio oficial',
    'peregrinación católica Garabandal',
    'Nuestra Señora de Garabandal',
    'peregrinación mariana España',
    'donaciones católicas',
    'Virgen del Carmen de Garabandal',
  ],
  alternates: {
    canonical: `${APP_URL}/es`,
    languages: {
      es: `${APP_URL}/es`,
      en: `${APP_URL}/en`,
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: `${APP_URL}/es`,
    siteName: SITE_NAME,
    title: 'Apostolado de Garabandal',
    description: 'Peregrinaciones marianas católicas, donaciones, membresía y tienda católica. Apostolado de Garabandal oficial.',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Apostolado de Garabandal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apostolado de Garabandal',
    description: 'Peregrinaciones marianas católicas, donaciones, membresía y tienda católica.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function SpanishLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
