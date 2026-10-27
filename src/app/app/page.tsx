import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AppLanding from '../../components/promo/AppLanding';
import { resolveAppEntry } from '../../lib/app-entry';
import { APP_URL } from '../../lib/config';

// Short link for emails, WhatsApp, Instagram, print and the QR code. Phones go
// straight to their store; everything else (desktop, crawlers) sees the landing
// page. Reading request headers makes this route dynamic, which is intended.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Garabandal+: a app do Apostolado de Garabandal',
  description: 'Orações, novenas, liturgia do dia e comunidade de oração. Descarregue a app Garabandal+ na App Store ou no Google Play.',
  alternates: {
    canonical: `${APP_URL}/app`,
    languages: { 'pt-BR': `${APP_URL}/app`, 'pt-PT': `${APP_URL}/app`, en: `${APP_URL}/en/app` },
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ src?: string | string[] }> }) {
  const { src } = await searchParams;
  const { links, platform } = await resolveAppEntry('pt', src);
  if (platform === 'ios') redirect(links.appStore);
  if (platform === 'android') redirect(links.googlePlay);
  return <AppLanding locale="pt" links={links} />;
}
