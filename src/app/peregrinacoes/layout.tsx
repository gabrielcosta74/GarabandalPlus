import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Peregrinações',
  description: 'Peregrinações católicas organizadas pelo Apostolado de Garabandal. Conheça as próximas datas e roteiros.',
  alternates: {
    canonical: `${APP_URL}/peregrinacoes`,
  },
  openGraph: {
    url: `${APP_URL}/peregrinacoes`,
    title: 'Peregrinações | Apostolado de Garabandal',
    description: 'Conheça as próximas peregrinações e participe da missão.',
  },
};

export default function PeregrinacoesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
