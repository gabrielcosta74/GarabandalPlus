import { loadMeta } from '../lib/donations';
import HomePageClient from '../components/home/HomePageClient';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Início',
  description: 'Bem-vindo ao Santuário Virtual de Garabandal. Envie as suas intenções, faça parte da comunidade e apoie a nossa missão de evangelização.',
};

export default async function Page() {
  const meta = await loadMeta();

  return <HomePageClient meta={meta} />;
}
