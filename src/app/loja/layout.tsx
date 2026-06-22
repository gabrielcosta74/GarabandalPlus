import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';

const title = 'Livros sobre Garabandal | Loja do Apostolado de Garabandal';
const description = 'Loja oficial do Apostolado de Garabandal. Livros sobre as aparições de Nossa Senhora de Garabandal, Conchita, Mari Loli, Jacinta e Mari Cruz, e a mensagem de Garabandal. Entrega para Brasil e Portugal.';
const url = `${APP_URL}/loja`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'livros sobre Garabandal',
    'livros aparições de Garabandal',
    'livro Conchita Garabandal',
    'livros Nossa Senhora de Garabandal',
    'livros marianos católicos',
    'livro mensagem de Garabandal',
    'livros aparições marianas',
    'livro o aviso Garabandal',
    'livraria católica online Brasil',
    'livros católicos Apostolado de Garabandal',
    'livros videntes de Garabandal',
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
    siteName: 'Apostolado de Garabandal',
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
