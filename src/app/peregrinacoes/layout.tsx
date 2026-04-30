import type { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import { supabaseServer } from '../../lib/supabase';
import {
  BRAND_NAME,
  DEFAULT_OG_IMAGE,
  getAbsoluteUrl,
  getPilgrimageSeoImages,
  ORGANIZATION_ID,
  WEBSITE_ID,
} from '../../lib/seo';

const title = 'Peregrinações Marianas Católicas';
const description = 'Peregrinações marianas católicas a Garabandal, Fátima e santuários ibéricos, com programa espiritual, guia do Apostolado e vagas para Brasil e Portugal.';
const url = `${APP_URL}/peregrinacoes`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'peregrinação Garabandal',
    'peregrinações marianas católicas',
    'peregrinação mariana católica',
    'peregrinação mariana Brasil',
    'peregrinação mariana Portugal',
    'peregrinação católica organizada',
    'peregrinação Garabandal 2026',
    'peregrinação Fátima Garabandal',
    'peregrinação católica Fátima Garabandal',
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
    siteName: BRAND_NAME,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Peregrinações marianas católicas a Garabandal com o Apostolado de Garabandal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [DEFAULT_OG_IMAGE],
  },
};

type PilgrimageSeoRecord = {
  title: string | null;
  slug: string | null;
  description: string | null;
  cover_image: string | null;
  start_date: string | null;
  end_date: string | null;
  base_price: number | null;
  status: string | null;
};

const fetchUpcomingPilgrimages = async (): Promise<PilgrimageSeoRecord[]> => {
  if (!supabaseServer) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseServer
    .from('pilgrimages')
    .select('title, slug, description, cover_image, start_date, end_date, base_price, status')
    .gte('end_date', today)
    .in('status', ['open', 'waitlist', 'active', 'ativo'])
    .order('start_date', { ascending: true })
    .limit(10);

  if (error || !data) return [];
  return data as PilgrimageSeoRecord[];
};

export default async function PeregrinacoesLayout({ children }: { children: React.ReactNode }) {
  const pilgrimages = await fetchUpcomingPilgrimages();
  const visiblePilgrimages = pilgrimages.filter((pilgrimage) => Boolean(pilgrimage.slug));
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
    '@id': `${url}#collection`,
    name: 'Peregrinações Marianas Católicas',
    headline: title,
    description,
    url,
    inLanguage: 'pt-BR',
    isPartOf: { '@id': WEBSITE_ID },
    publisher: {
      '@id': ORGANIZATION_ID,
    },
    mainEntity: {
      '@type': 'ItemList',
      name: 'Peregrinações marianas disponíveis',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: visiblePilgrimages.length,
      itemListElement: visiblePilgrimages.map((pilgrimage, index) => {
        const itemUrl = `${APP_URL}/peregrinacoes/${pilgrimage.slug}`;
        const images = getPilgrimageSeoImages(pilgrimage.cover_image);

        return {
          '@type': 'ListItem',
          position: index + 1,
          url: itemUrl,
          item: {
            '@type': 'Event',
            name: pilgrimage.title || 'Peregrinação Mariana Católica',
            description: pilgrimage.description || description,
            startDate: pilgrimage.start_date || undefined,
            endDate: pilgrimage.end_date || undefined,
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            eventStatus: 'https://schema.org/EventScheduled',
            image: images,
            url: itemUrl,
            organizer: { '@id': ORGANIZATION_ID },
            location: {
              '@type': 'Place',
              name: 'San Sebastián de Garabandal',
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Garabandal',
                addressRegion: 'Cantabria',
                addressCountry: 'ES',
              },
            },
            offers: pilgrimage.base_price
              ? {
                '@type': 'Offer',
                price: pilgrimage.base_price,
                priceCurrency: 'EUR',
                url: itemUrl,
                availability: pilgrimage.status === 'waitlist'
                  ? 'https://schema.org/LimitedAvailability'
                  : 'https://schema.org/InStock',
                seller: { '@id': ORGANIZATION_ID },
              }
              : undefined,
          },
        };
      }),
    },
    image: getAbsoluteUrl('/images/nossasenhoragarabandal.jpg'),
    about: [
      'Peregrinações marianas católicas',
      'Nossa Senhora de Garabandal',
      'Aparições marianas',
      'Santuários católicos ibéricos',
    ],
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
