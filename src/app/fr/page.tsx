import type { Metadata } from 'next';
import { LocaleHomePage, LOCALE_HOME_COPY, localeHomeAlternates } from '../../components/content/LocaleHomePage';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';
import { APP_URL } from '../../lib/config';

export const revalidate = 600;

const copy = LOCALE_HOME_COPY.fr;

export const metadata: Metadata = {
  title: { absolute: 'Apostolat de Garabandal — Apparitions, messages et pèlerinages' },
  description: copy.lead,
  alternates: localeHomeAlternates('fr'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: `${APP_URL}/fr`,
    siteName: SITE_NAME,
    title: 'Apostolat de Garabandal — Apparitions, messages et pèlerinages',
    description: copy.lead,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Apostolat de Garabandal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apostolat de Garabandal — Apparitions, messages et pèlerinages',
    description: copy.lead,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function Page() {
  return <LocaleHomePage locale="fr" />;
}
