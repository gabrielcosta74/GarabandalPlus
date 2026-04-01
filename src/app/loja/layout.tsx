import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';

const title = 'Loja Católica Online | Artigos Religiosos — Apostolado de Garabandal';
const description = 'Loja oficial do Apostolado de Garabandal. Livros católicos, terços, artigos religiosos e materiais de formação espiritual. Entrega para o Brasil e Portugal.';
const url = `${APP_URL}/loja`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'loja católica online Brasil',
    'artigos religiosos católicos',
    'livros católicos online',
    'terço Nossa Senhora Garabandal',
    'produtos religiosos Brasil',
    'artigos religiosos Nossa Senhora',
    'loja apostolado Garabandal',
    'materiais espirituais católicos',
    'formação espiritual católica',
  ],
  alternates: {
    canonical: url,
    languages: {
      'pt-BR': url,
      'pt-PT': url,
      'en': `${APP_URL}/en/store`,
    },
  },
  openGraph: {
    url,
    title,
    description,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Garabandal +',
    images: [
      {
        url: `${APP_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'Loja Católica — Apostolado de Garabandal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [`${APP_URL}/opengraph-image`],
  },
};

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Loja do Apostolado de Garabandal',
    description,
    url,
    inLanguage: 'pt-BR',
    currenciesAccepted: 'EUR, BRL',
    paymentAccepted: 'PIX, Cartão de Crédito, MB WAY, Multibanco, Transferência Bancária',
    areaServed: [
      { '@type': 'Country', name: 'Brasil' },
      { '@type': 'Country', name: 'Portugal' },
    ],
    seller: {
      '@type': 'Organization',
      name: 'Apostolado de Garabandal',
      url: APP_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }}
      />
      {children}
    </>
  );
}
