import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: {
    template: '%s | Apostolado de Garabandal',
    default: 'Apostolato di Garabandal',
  },
  description: "Apostolato di Garabandal: apparizioni mariane di Nostra Signora del Monte Carmelo a Garabandal, messaggi, insegnamenti cattolici, testimonianze e pellegrinaggi.",
  keywords: [
    'Garabandal',
    'apparizioni di Garabandal',
    'Nostra Signora del Monte Carmelo',
    'messaggi di Garabandal',
    'apparizioni mariane',
    'il Grande Miracolo',
    "l'Avvertimento",
    'Conchita Garabandal',
    'pellegrinaggio cattolico',
    'fede cattolica',
  ],
  alternates: {
    canonical: `${APP_URL}/it`,
    languages: {
      it: `${APP_URL}/it`,
      fr: `${APP_URL}/fr`,
      es: `${APP_URL}/es`,
      en: `${APP_URL}/en`,
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: `${APP_URL}/it`,
    siteName: SITE_NAME,
    title: 'Apostolato di Garabandal',
    description: "Apparizioni mariane, messaggi e insegnamenti cattolici di Garabandal. Testimonianze e pellegrinaggi.",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Apostolato di Garabandal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apostolato di Garabandal',
    description: "Apparizioni mariane, messaggi e insegnamenti cattolici di Garabandal.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function ItalianLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
