import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { richTextToPlain } from '../../../lib/rich-text';
import { supabaseServer } from '../../../lib/supabase';
import { isPreLaunch } from '../../../lib/pilgrimage-early-access';
import {
  BRAND_NAME,
  DEFAULT_OG_IMAGE,
  getPilgrimageSeoImages,
  ORGANIZATION_ID,
  truncateMetaDescription,
  WEBSITE_ID,
} from '../../../lib/seo';

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
    .select('title, description, cover_image, start_date, end_date, base_price, status, registration_deadline, meeting_point_text, meeting_end_text, itinerary_summary, created_at, pricing_config')
    .eq('slug', slug)
    .maybeSingle();
  return data || null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const url = `${APP_URL}/peregrinacoes/${slug}`;
  const fallbackTitle = `Peregrinação Mariana Católica ${slugToTitle(slug)} | Garabandal`;
  const fallbackDescription = 'Peregrinação mariana católica organizada pelo Apostolado de Garabandal, com programa espiritual, acompanhamento e inscrição online.';

  if (!supabaseServer) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }

  try {
    const data = await fetchPilgrimage(slug);

    // Private early-access window: never expose the real title/description/OG
    // to crawlers or link previews before launch.
    if (data && isPreLaunch(data)) {
      return {
        title: 'Acesso privado | Apostolado de Garabandal',
        description: 'Página de acesso privado por convite.',
        robots: { index: false, follow: false },
        alternates: { canonical: url },
      };
    }

    const title = data?.title
      ? `${data.title} | Peregrinação Mariana Católica`
      : fallbackTitle;
    const description = truncateMetaDescription(
      data?.description,
      fallbackDescription,
      158,
    );

    const seoImages = getPilgrimageSeoImages(data?.cover_image);
    const ogImages = seoImages.slice(0, 3).map((imageUrl) => ({
      url: imageUrl,
      width: 1200,
      height: 630,
      alt: data?.title
        ? `${data.title} - peregrinação mariana católica`
        : 'Peregrinação mariana católica a Garabandal',
    }));

    return {
      title,
      description,
      keywords: [
        data?.title || 'peregrinação mariana',
        'peregrinação mariana católica',
        'peregrinações marianas católicas',
        'peregrinação Garabandal',
        'peregrinação mariana Brasil',
        'peregrinação mariana Portugal',
        'peregrinação ibérica católica',
        'peregrinação católica organizada',
        'Apostolado de Garabandal',
        'Nossa Senhora de Garabandal',
        'tour espiritual católico',
        'santuários católicos Portugal Espanha',
      ],
      alternates: {
        canonical: url,
        languages: {
          'pt-BR': url,
          'pt-PT': url,
          'en': `${APP_URL}/en/pilgrimages/${slug}`,
        },
      },
      openGraph: {
        url,
        title,
        description,
        type: 'website',
        locale: 'pt_BR',
        siteName: BRAND_NAME,
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
      alternates: {
        canonical: url,
        languages: {
          'pt-BR': url,
          'pt-PT': url,
          'en': `${APP_URL}/en/pilgrimages/${slug}`,
        },
      },
      openGraph: {
        url,
        title: fallbackTitle,
        description: fallbackDescription,
        siteName: BRAND_NAME,
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: fallbackTitle }],
      },
    };
  }
}

export default async function PeregrinacaoLayout({ children, params }: Props) {
  const { slug } = await params;
  const pilgrimage = await fetchPilgrimage(slug);

  // No structured data for a not-found or private pre-launch pilgrimage.
  if (!pilgrimage || isPreLaunch(pilgrimage)) {
    return children;
  }

  const pageUrl = `${APP_URL}/peregrinacoes/${slug}`;
  const images = getPilgrimageSeoImages(pilgrimage.cover_image);
  const availability = pilgrimage.status === 'waitlist'
    ? 'https://schema.org/LimitedAvailability'
    : pilgrimage.status === 'closed'
      ? 'https://schema.org/SoldOut'
      : 'https://schema.org/InStock';

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${pageUrl}#event`,
    name: pilgrimage.title || 'Peregrinação Mariana',
    alternateName: pilgrimage.title
      ? `${pilgrimage.title} - Peregrinação Mariana Católica`
      : 'Peregrinação Mariana Católica a Garabandal',
    description: richTextToPlain(pilgrimage.description) || 'Peregrinação mariana católica organizada pelo Apostolado de Garabandal.',
    url: pageUrl,
    startDate: pilgrimage.start_date || undefined,
    endDate: pilgrimage.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    inLanguage: 'pt-BR',
    image: images,
    isPartOf: { '@id': WEBSITE_ID },
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
      '@id': ORGANIZATION_ID,
    },
    performer: {
      '@id': ORGANIZATION_ID,
    },
    audience: {
      '@type': 'Audience',
      audienceType: 'Peregrinos católicos e devotos de Nossa Senhora de Garabandal',
    },
    keywords: 'peregrinação mariana católica, Garabandal, Nossa Senhora, Fátima, apostolado, Brasil, Portugal',
    about: [
      'Nossa Senhora de Garabandal',
      'Peregrinações marianas católicas',
      'Santuários católicos ibéricos',
      'Vida espiritual católica',
    ],
    offers: pilgrimage.base_price
      ? {
        '@type': 'Offer',
        price: pilgrimage.base_price,
        priceCurrency: 'EUR',
        url: pageUrl,
        availability,
        seller: { '@id': ORGANIZATION_ID },
        validFrom: pilgrimage.created_at || undefined,
        validThrough: pilgrimage.registration_deadline || undefined,
      }
      : undefined,
  };

  const tripSchema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${pageUrl}#trip`,
    name: pilgrimage.title || 'Peregrinação Mariana Católica',
    description: richTextToPlain(pilgrimage.description) || 'Viagem espiritual mariana organizada pelo Apostolado de Garabandal.',
    image: images,
    url: pageUrl,
    provider: { '@id': ORGANIZATION_ID },
    touristType: 'Peregrinos católicos',
    itinerary: pilgrimage.itinerary_summary || undefined,
    departureTime: pilgrimage.start_date || undefined,
    arrivalTime: pilgrimage.end_date || undefined,
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
        item: pageUrl,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tripSchema) }}
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
