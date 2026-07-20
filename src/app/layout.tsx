import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import ClientLayout from '../components/layouts/ClientLayout';
import './globals.css';
import { APP_URL } from '../lib/config';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') || '';
  // The <html lang> reflects the MAIN CONTENT language (for SEO/accessibility),
  // even though the site chrome stays Portuguese on /es and /fr. Match the first
  // path segment exactly so PT slugs like /encontro or /frutos aren't misread.
  const localeSeg = pathname.split('/')[1];
  const htmlLang = localeSeg === 'en' ? 'en' : localeSeg === 'es' ? 'es' : localeSeg === 'fr' ? 'fr' : localeSeg === 'it' ? 'it' : 'pt-BR';
  const navV2Enabled = process.env.NEXT_PUBLIC_NAV_V2 === '1';
  return (
    <html lang={htmlLang}>
      <head>
        <meta name="supported-color-schemes" content="light dark" />
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
        {/* Sender.net — universal tracking/forms snippet (loaded once for the whole site) */}
        <Script id="sender-universal" strategy="afterInteractive">
          {`(function (s, e, n, d, er) {
            s['Sender'] = er;
            s[er] = s[er] || function () {
              (s[er].q = s[er].q || []).push(arguments)
            }, s[er].l = 1 * new Date();
            s[er].on = function(event, callback) {
              s[er].listeners = s[er].listeners || {};
              (s[er].listeners[event] = s[er].listeners[event] || []).push(callback);
            };
            var a = e.createElement(n),
                m = e.getElementsByTagName(n)[0];
            a.async = 1;
            a.src = d;
            m.parentNode.insertBefore(a, m)
          })(window, document, 'script', 'https://cdn.sender.net/accounts_resources/universal.js', 'sender');
          sender('0c380a08998972')`}
        </Script>
      </head>
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
                    'https://apostoladodegarabandal.com',
                  ],
                  nonprofitStatus: 'ReligiousNonprofit',
                },
                {
                  '@type': 'WebSite',
                  '@id': `${APP_URL}/#website`,
                  name: 'Apostolado de Garabandal',
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
        <ClientLayout navV2Enabled={navV2Enabled}>{children}</ClientLayout>
      </body>
    </html>
  );
}
