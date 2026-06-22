import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: {
    template: '%s | Apostolado de Garabandal',
    default: 'Apostolat de Garabandal',
  },
  description: "Apostolat de Garabandal : apparitions mariales de Notre-Dame du Mont-Carmel à Garabandal, messages, enseignements catholiques, témoignages et pèlerinages.",
  keywords: [
    'Garabandal',
    'apparitions de Garabandal',
    'Notre-Dame du Mont-Carmel',
    'messages de Garabandal',
    'apparitions mariales',
    'le Grand Miracle',
    "l'Avertissement",
    'Conchita Garabandal',
    'pèlerinage catholique',
    'foi catholique',
  ],
  alternates: {
    canonical: `${APP_URL}/fr`,
    languages: {
      fr: `${APP_URL}/fr`,
      es: `${APP_URL}/es`,
      en: `${APP_URL}/en`,
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: `${APP_URL}/fr`,
    siteName: SITE_NAME,
    title: 'Apostolat de Garabandal',
    description: "Apparitions mariales, messages et enseignements catholiques de Garabandal. Témoignages et pèlerinages.",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Apostolat de Garabandal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apostolat de Garabandal',
    description: "Apparitions mariales, messages et enseignements catholiques de Garabandal.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function FrenchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
