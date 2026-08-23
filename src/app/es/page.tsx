import type { Metadata } from 'next';
import { LocaleHomePage, LOCALE_HOME_COPY, localeHomeAlternates } from '../../components/content/LocaleHomePage';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';
import { APP_URL } from '../../lib/config';

export const revalidate = 600;

const copy = LOCALE_HOME_COPY.es;

export const metadata: Metadata = {
  title: { absolute: 'Apostolado de Garabandal — Apariciones, mensajes y peregrinaciones' },
  description: copy.lead,
  alternates: localeHomeAlternates('es'),
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: `${APP_URL}/es`,
    siteName: SITE_NAME,
    title: 'Apostolado de Garabandal — Apariciones, mensajes y peregrinaciones',
    description: copy.lead,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Apostolado de Garabandal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apostolado de Garabandal — Apariciones, mensajes y peregrinaciones',
    description: copy.lead,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function Page() {
  return <LocaleHomePage locale="es" />;
}
