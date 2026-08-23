import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import ClientLayout from '../components/layouts/ClientLayout';
import AbortErrorSilencer from '../components/system/AbortErrorSilencer';
import SenderScript from '../components/system/SenderScript';
import './globals.css';
import { APP_URL } from '../lib/config';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

// Usadas apenas no painel de administração (ver AdminLayout). O site público
// mantém a Inter, por isso só expomos as variáveis — nada muda por omissão.
const adminSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-admin-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

// Advertise both schemes so Samsung Internet can prefer our media-query styles
// instead of auto-transforming colors, while globals.css keeps both schemes light.
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    template: '%s | Apostolado de Garabandal',
    default: 'Apostolado de Garabandal — Aparições, mensagens e peregrinações',
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
    siteName: 'Apostolado de Garabandal',
    title: 'Apostolado de Garabandal — Aparições, mensagens e peregrinações',
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
    title: 'Apostolado de Garabandal — Aparições, mensagens e peregrinações',
    description: 'Peregrinações marianas, doações e missão de evangelização. Apostolado de Nossa Senhora de Garabandal.',
    images: [`${APP_URL}/opengraph-image`],
  },
  alternates: {
    canonical: APP_URL,
    languages: {
      'x-default': APP_URL,
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
      en: `${APP_URL}/en`,
      es: `${APP_URL}/es`,
      fr: `${APP_URL}/fr`,
      it: `${APP_URL}/it`,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
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
  // NOTE: do not read `headers()` (or cookies) here. This layout wraps every
  // route, so a single dynamic API call opts the whole site into per-request
  // rendering — production was serving `cache-control: no-store` on all 1482
  // URLs and the `export const revalidate` in the page segments never applied.
  //
  // `lang` therefore defaults to Portuguese here; each locale segment
  // (src/app/{en,es,fr,it}/layout.tsx) re-declares the language on its own
  // wrapper, which is what the HTML spec resolves against for that subtree.
  const navV2Enabled = process.env.NEXT_PUBLIC_NAV_V2 === '1';
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="supported-color-schemes" content="light dark" />
        {/* Third-party origins used below the fold. Connecting early saves the
            DNS + TLS round trip when the request is finally made. */}
        <link rel="preconnect" href="https://cdn.sender.net" crossOrigin="" />
        <link rel="preconnect" href="https://pntzzuxzjnzksubbjfvj.supabase.co" />
        {/* Hide the SSR'd cookie banner before first paint for visitors who already
            consented (consent lives in localStorage, unreadable on the server).
            Keeping the banner in the SSR HTML lets it paint at FCP instead of after
            hydration, which was inflating mobile LCP to ~7s. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem('garabandal_cookie_consent_v1'));if(c&&c.version===1&&c.necessary===true)document.documentElement.classList.add('cc-done')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${adminSans.variable} ${geistMono.variable} ${inter.className}`}>
        <AbortErrorSilencer />
        <SenderScript />
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
                  // Entity links. These are how a search engine — and the AI
                  // answer engines that read the same graph — tie the site to a
                  // recognised entity rather than an anonymous domain. YouTube
                  // matters most here: mentions there correlate more strongly
                  // with AI citations than any other public signal, and the
                  // channel was missing from this list entirely.
                  // Listing the site's own URL adds nothing — `url` already
                  // states it — so it is dropped.
                  sameAs: [
                    'https://www.youtube.com/@apostoladodegarabandal',
                    'https://www.instagram.com/apostoladodegarabandaloficial/',
                  ],
                  nonprofitStatus: 'ReligiousNonprofit',
                },
                {
                  '@type': 'WebSite',
                  '@id': `${APP_URL}/#website`,
                  name: 'Apostolado de Garabandal',
                  url: APP_URL,
                  inLanguage: ['pt-BR', 'pt-PT', 'en', 'es', 'fr', 'it'],
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
        <ClientLayout navV2Enabled={navV2Enabled}>{children}</ClientLayout>
      </body>
    </html>
  );
}
