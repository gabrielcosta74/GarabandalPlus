import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AppLanding from '../../../components/promo/AppLanding';
import { resolveAppEntry } from '../../../lib/app-entry';
import { APP_URL } from '../../../lib/config';

// See src/app/app/page.tsx: same short link, English copy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Garabandal+: the Garabandal Apostolate app',
  description: 'Prayers, novenas, the daily liturgy and a community of prayer. Download the Garabandal+ app on the App Store or Google Play.',
  alternates: {
    canonical: `${APP_URL}/en/app`,
    languages: { 'pt-BR': `${APP_URL}/app`, 'pt-PT': `${APP_URL}/app`, en: `${APP_URL}/en/app` },
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ src?: string | string[] }> }) {
  const { src } = await searchParams;
  const { links, platform } = await resolveAppEntry('en', src);
  if (platform === 'ios') redirect(links.appStore);
  if (platform === 'android') redirect(links.googlePlay);
  return <AppLanding locale="en" links={links} />;
}
