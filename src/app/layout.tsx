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
    default: 'Garabandal +',
  },
  description: 'Santuário virtual do Apostolado de Garabandal. Peregrinações, doações e missão de evangelização com foco na fé e na mensagem de Nossa Senhora.',
  keywords: [
    'Garabandal',
    'Apostolado de Garabandal',
    'Peregrinação católica',
    'Doações católicas',
    'Mensagem de Garabandal',
    'Santuário virtual',
    'Nossa Senhora',
    'Evangelização'
  ],
  authors: [{ name: 'Apostolado de Garabandal' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: 'Garabandal +',
    title: 'Garabandal +',
    description: 'Santuário virtual com peregrinações, doações e missão de evangelização.',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Apostolado de Garabandal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Garabandal +',
    description: 'Santuário virtual com peregrinações, doações e missão de evangelização.',
    images: ['/images/og-image.jpg'],
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
      <body className={inter.className}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'Garabandal +',
                  url: APP_URL,
                  logo: `${APP_URL}/images/og-image.jpg`,
                  sameAs: [
                    'https://www.instagram.com/apostoladodegarabandaloficial/'
                  ]
                },
                {
                  '@type': 'WebSite',
                  name: 'Garabandal +',
                  url: APP_URL,
                  inLanguage: 'pt-BR'
                }
              ]
            })
          }}
        />
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
