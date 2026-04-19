import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import ClientLayout from '../components/layouts/ClientLayout';
import './globals.css';
import { APP_URL } from '../lib/config';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    template: '%s | Garabandal +',
    default: 'Garabandal + | Apostolado de Garabandal',
  },
  description: 'Apostolado de Garabandal — associação sem fins lucrativos dedicada à divulgação das aparições de Nossa Senhora de Garabandal, organização de peregrinações marianas e apostolado da fé no Brasil e em Portugal.',
  keywords: [
    'Apostolado de Garabandal',
    'peregrinação Garabandal',
    'peregrinação mariana Brasil',
    'Nossa Senhora de Garabandal',
    'aparições de Garabandal',
    'peregrinação católica Brasil',
    'peregrinação mariana',
    'o aviso de Garabandal',
    'Nossa Senhora do Carmo Garabandal',
    'apostolado mariano',
    'peregrinação Fátima Garabandal',
    'artigos religiosos católicos',
    'doação apostolado católico',
    'mensagem de Garabandal',
    'evangelização católica',
  ],
  authors: [{ name: 'Apostolado de Garabandal' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: 'Garabandal +',
    title: 'Garabandal + | Apostolado de Garabandal',
    description: 'Associação sem fins lucrativos. Aparições de Garabandal, peregrinações marianas, apostolado da fé e evangelização no Brasil e em Portugal.',
    images: [
      {
        url: `${APP_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'Apostolado de Garabandal — Peregrinações Marianas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Garabandal + | Apostolado de Garabandal',
    description: 'Peregrinações marianas, doações e missão de evangelização. Apostolado de Nossa Senhora de Garabandal.',
    images: [`${APP_URL}/opengraph-image`],
  },
  alternates: {
    canonical: APP_URL,
    languages: {
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
      'en': `${APP_URL}/en`,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head />
      <body className={`${inter.variable} ${playfair.variable} ${inter.className}`}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': ['Organization', 'NGO', 'ReligiousOrganization'],
                  '@id': `${APP_URL}/#organization`,
                  name: 'Apostolado de Garabandal',
                  alternateName: 'Garabandal +',
                  url: APP_URL,
                  logo: {
                    '@type': 'ImageObject',
                    url: `${APP_URL}/icon-512.png`,
                    width: 512,
                    height: 512,
                  },
                  description: 'Associação católica dedicada à divulgação das aparições de Nossa Senhora de Garabandal, organização de peregrinações marianas e apostolado mariano em português.',
                  knowsAbout: [
                    'Aparições de Garabandal',
                    'Nossa Senhora de Garabandal',
                    'Nossa Senhora do Carmo',
                    'O Aviso de Garabandal',
                    'Peregrinações Marianas',
                    'Aparições Marianas',
                    'Evangelização Católica',
                    'Peregrinação Católica Brasil',
                  ],
                  areaServed: [
                    { '@type': 'Country', name: 'Brasil' },
                    { '@type': 'Country', name: 'Portugal' },
                  ],
                  sameAs: [
                    'https://www.instagram.com/apostoladodegarabandaloficial/',
                    'https://www.apostoladodegarabandal.com',
                  ],
                  nonprofitStatus: 'ReligiousNonprofit',
                },
                {
                  '@type': 'WebSite',
                  '@id': `${APP_URL}/#website`,
                  name: 'Garabandal +',
                  url: APP_URL,
                  inLanguage: ['pt-BR', 'pt-PT', 'en'],
                  publisher: { '@id': `${APP_URL}/#organization` },
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: `${APP_URL}/loja?q={search_term_string}`,
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
              ]
            })
          }}
        />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
