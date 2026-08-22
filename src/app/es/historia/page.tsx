import type { Metadata } from 'next';
import { CategoryIndexPage } from '../../../components/content/CategoryIndexPage';
import { CATEGORIES } from '../../../lib/cms/categories';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;
const CAT = 'historia' as const;
const cfg = CATEGORIES[CAT];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${cfg.es.label} de Garabandal`,
    description: cfg.es.tagline,
    alternates: {
      canonical: `${APP_URL}/es/${cfg.es.slug}`,
      languages: {
        'pt-BR': `${APP_URL}/${cfg.pt.slug}`,
        en: `${APP_URL}/en/${cfg.en.slug}`,
        es: `${APP_URL}/es/${cfg.es.slug}`,
        fr: `${APP_URL}/fr/${cfg.fr.slug}`,
        it: `${APP_URL}/it/${cfg.it.slug}`,
        'x-default': `${APP_URL}/${cfg.pt.slug}`,
      },
    },
  };
}

export default async function Page() {
  return <CategoryIndexPage category={CAT} locale="es" />;
}
