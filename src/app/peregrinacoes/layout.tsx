import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';

const title = 'Peregrinações Marianas a Garabandal | Apostolado de Garabandal';
const description = 'Peregrinações marianas a Garabandal e santuários católicos, organizadas pelo Apostolado de Garabandal (associação sem fins lucrativos) para peregrinos do Brasil e de Portugal.';
const url = `${APP_URL}/peregrinacoes`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'peregrinação Garabandal',
    'peregrinação mariana Brasil',
    'peregrinação católica organizada',
    'peregrinação Garabandal 2025',
    'peregrinação Garabandal 2026',
    'peregrinação Fátima Garabandal',
    'peregrinação Nossa Senhora',
    'tour religioso católico Brasil',
    'Apostolado de Garabandal peregrinação',
    'viagem espiritual mariana',
  ],
  alternates: {
    canonical: url,
    languages: {
      'pt-BR': url,
      'pt-PT': url,
      'en': `${APP_URL}/en/pilgrimages`,
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
        alt: 'Peregrinações Marianas — Apostolado de Garabandal',
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

export default function PeregrinacoesLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Início',
        item: `${APP_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Peregrinações',
        item: url,
      },
    ],
  };

  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Peregrinações Marianas',
    description,
    url,
    inLanguage: 'pt-BR',
    publisher: {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      {children}
    </>
  );
}
