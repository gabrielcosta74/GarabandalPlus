import type { Metadata } from 'next';
import { LocaleHomePage, LOCALE_HOME_COPY, localeHomeAlternates } from '../../components/content/LocaleHomePage';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../lib/seo';
import { APP_URL } from '../../lib/config';

export const revalidate = 600;

const copy = LOCALE_HOME_COPY.it;

export const metadata: Metadata = {
  title: { absolute: 'Apostolato di Garabandal — Apparizioni, messaggi e pellegrinaggi' },
  description: copy.lead,
  alternates: localeHomeAlternates('it'),
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: `${APP_URL}/it`,
    siteName: SITE_NAME,
    title: 'Apostolato di Garabandal — Apparizioni, messaggi e pellegrinaggi',
    description: copy.lead,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Apostolato di Garabandal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apostolato di Garabandal — Apparizioni, messaggi e pellegrinaggi',
    description: copy.lead,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function Page() {
  return <LocaleHomePage locale="it" />;
}
