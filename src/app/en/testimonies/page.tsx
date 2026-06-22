import type { Metadata } from 'next';
import { CategoryIndexPage } from '../../../components/content/CategoryIndexPage';
import { CATEGORIES } from '../../../lib/cms/categories';
import { isPreviewSession } from '../../../lib/content/preview';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;
const CAT = 'testemunhos' as const;
const cfg = CATEGORIES[CAT];

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPreviewSession())) return { title: cfg.en.label, robots: { index: false, follow: false } };
  return {
    title: cfg.en.label,
    description: cfg.en.tagline,
    alternates: {
      canonical: `${APP_URL}/en/${cfg.en.slug}`,
      languages: {
        'pt-BR': `${APP_URL}/${cfg.pt.slug}`,
        en: `${APP_URL}/en/${cfg.en.slug}`,
      },
    },
  };
}

export default async function Page() {
  return <CategoryIndexPage category={CAT} locale="en" />;
}
