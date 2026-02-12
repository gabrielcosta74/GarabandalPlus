import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Loja online',
  description: 'Loja oficial do Apostolado de Garabandal com livros, materiais espirituais e conteúdos digitais.',
  alternates: {
    canonical: `${APP_URL}/loja`,
  },
  openGraph: {
    url: `${APP_URL}/loja`,
    title: 'Loja online do Apostolado de Garabandal',
    description: 'Livros, materiais espirituais e conteúdos digitais para apoiar a missão.',
  },
};

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
