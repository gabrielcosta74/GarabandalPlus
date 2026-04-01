import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { supabaseServer } from '../../../lib/supabase';

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

const slugToTitle = (slug: string) =>
  slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fetchPilgrimage = async (slug: string) => {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('pilgrimages')
    .select('title, description, cover_image, start_date, end_date, base_price')
    .eq('slug', slug)
    .maybeSingle();
  return data || null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const url = `${APP_URL}/peregrinacoes/${slug}`;
  const fallbackTitle = `Peregrinação ${slugToTitle(slug)} | Garabandal +`;
  const fallbackDescription = 'Peregrinação mariana organizada pelo Apostolado de Garabandal. Junte-se a nós nesta viagem espiritual.';

  if (!supabaseServer) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }

  try {
    const data = await fetchPilgrimage(slug);

    const title = data?.title ? `${data.title} | Apostolado de Garabandal` : fallbackTitle;
    const description = data?.description
      ? `${data.description.slice(0, 155)}…`
      : fallbackDescription;

    const ogImages = data?.cover_image
      ? [{ url: data.cover_image, width: 1200, height: 630, alt: data.title || 'Peregrinação Mariana' }]
      : [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: title }];

    return {
      title,
      description,
      keywords: [
        data?.title || 'peregrinação mariana',
        'peregrinação Garabandal',
        'peregrinação mariana Brasil',
        'peregrinação católica organizada',
        'Apostolado de Garabandal',
        'Nossa Senhora de Garabandal',
        'tour espiritual católico',
      ],
      alternates: {
        canonical: url,
        languages: {
          'pt-BR': url,
          'pt-PT': url,
        },
      },
      openGraph: {
        url,
        title,
        description,
        type: 'website',
        locale: 'pt_BR',
        siteName: 'Garabandal +',
        images: ogImages,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ogImages.map((i) => i.url),
      },
    };
  } catch {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }
}

export default async function PeregrinacaoLayout({ children, params }: Props) {
  const { slug } = await params;
  const pilgrimage = await fetchPilgrimage(slug);

  if (!pilgrimage) {
    return children;
  }

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': ['Event', 'TouristTrip'],
    name: pilgrimage.title || 'Peregrinação Mariana',
    description: pilgrimage.description || 'Peregrinação mariana organizada pelo Apostolado de Garabandal.',
    startDate: pilgrimage.start_date || undefined,
    endDate: pilgrimage.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    inLanguage: 'pt-BR',
    image: pilgrimage.cover_image
      ? [pilgrimage.cover_image]
      : [`${APP_URL}/opengraph-image`],
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
    organizer: {
      '@type': 'Organization',
      name: 'Apostolado de Garabandal',
      url: APP_URL,
    },
    audience: {
      '@type': 'Audience',
      audienceType: 'Católicos devotos de Nossa Senhora de Garabandal',
    },
    keywords: 'peregrinação mariana, Garabandal, Nossa Senhora, apostolado, Brasil, Portugal',
    offers: pilgrimage.base_price
      ? {
        '@type': 'Offer',
        price: pilgrimage.base_price,
        priceCurrency: 'EUR',
        url: `${APP_URL}/peregrinacoes/${slug}`,
        availability: 'https://schema.org/InStock',
        validFrom: new Date().toISOString(),
      }
      : undefined,
  };

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
        item: `${APP_URL}/peregrinacoes`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: pilgrimage.title || 'Peregrinação',
        item: `${APP_URL}/peregrinacoes/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
