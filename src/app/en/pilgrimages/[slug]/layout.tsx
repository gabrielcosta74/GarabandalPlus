import type { Metadata } from 'next';
import { APP_URL } from '../../../../lib/config';
import { supabaseServer } from '../../../../lib/supabase';
import {
  DEFAULT_OG_IMAGE,
  getPilgrimageSeoImages,
  ORGANIZATION_ID,
  SITE_NAME,
  truncateMetaDescription,
  WEBSITE_ID,
} from '../../../../lib/seo';

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
    .select('title, title_en, description, description_en, cover_image, start_date, end_date, base_price, status, registration_deadline, itinerary_summary, itinerary_summary_en')
    .eq('slug', slug)
    .maybeSingle();
  return data || null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ptUrl = `${APP_URL}/peregrinacoes/${slug}`;
  const enUrl = `${APP_URL}/en/pilgrimages/${slug}`;
  const fallbackTitle = `${slugToTitle(slug)} — Catholic Marian Pilgrimage to Garabandal`;
  const fallbackDescription = 'Catholic Marian pilgrimage to Garabandal organised by the Garabandal Apostolate. Spiritual programme, full guidance and online registration.';

  if (!supabaseServer) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: {
        canonical: enUrl,
        languages: { en: enUrl, 'pt-BR': ptUrl, 'pt-PT': ptUrl },
      },
    };
  }

  try {
    const data = await fetchPilgrimage(slug);
    const titleSource = data?.title_en || data?.title;
    const descriptionSource = data?.description_en || data?.description;

    const title = titleSource
      ? `${titleSource} | Catholic Marian Pilgrimage 2026`
      : fallbackTitle;
    const description = truncateMetaDescription(descriptionSource, fallbackDescription, 158);

    const seoImages = getPilgrimageSeoImages(data?.cover_image);
    const ogImages = seoImages.slice(0, 3).map((imageUrl) => ({
      url: imageUrl,
      width: 1200,
      height: 630,
      alt: titleSource
        ? `${titleSource} — Catholic Marian pilgrimage`
        : 'Catholic Marian pilgrimage to Garabandal',
    }));

    return {
      title,
      description,
      keywords: [
        titleSource || 'Garabandal pilgrimage',
        'Garabandal pilgrimage 2026',
        'Catholic Marian pilgrimage',
        'pilgrimage to Garabandal Spain',
        'Our Lady of Garabandal pilgrimage',
        'Garabandal Apostolate',
        'Marian pilgrimage Spain Portugal',
        'Catholic pilgrimage Europe 2026',
        'organised Catholic pilgrimage',
        'Garabandal Cantabria Spain',
      ],
      alternates: {
        canonical: enUrl,
        languages: { en: enUrl, 'pt-BR': ptUrl, 'pt-PT': ptUrl },
      },
      openGraph: {
        url: enUrl,
        title,
        description,
        type: 'website',
        locale: 'en_GB',
        siteName: SITE_NAME,
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
        canonical: enUrl,
        languages: { en: enUrl, 'pt-BR': ptUrl, 'pt-PT': ptUrl },
      },
      openGraph: {
        url: enUrl,
        title: fallbackTitle,
        description: fallbackDescription,
        siteName: SITE_NAME,
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: fallbackTitle }],
      },
    };
  }
}

export default async function EnPilgrimageLayout({ children, params }: Props) {
  const { slug } = await params;
  const pilgrimage = await fetchPilgrimage(slug);

  if (!pilgrimage) {
    return children;
  }

  const pageUrl = `${APP_URL}/en/pilgrimages/${slug}`;
  const images = getPilgrimageSeoImages(pilgrimage.cover_image);
  const availability = pilgrimage.status === 'waitlist'
    ? 'https://schema.org/LimitedAvailability'
    : pilgrimage.status === 'closed'
      ? 'https://schema.org/SoldOut'
      : 'https://schema.org/InStock';

  const title = pilgrimage.title_en || pilgrimage.title || 'Catholic Marian Pilgrimage';
  const description = pilgrimage.description_en || pilgrimage.description || 'Catholic Marian pilgrimage organised by the Garabandal Apostolate.';
  const itinerary = pilgrimage.itinerary_summary_en || pilgrimage.itinerary_summary || undefined;

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${pageUrl}#event`,
    name: title,
    alternateName: `${title} — Catholic Marian Pilgrimage`,
    description,
    url: pageUrl,
    startDate: pilgrimage.start_date || undefined,
    endDate: pilgrimage.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    inLanguage: 'en',
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
    organizer: { '@id': ORGANIZATION_ID },
    performer: { '@id': ORGANIZATION_ID },
    audience: {
      '@type': 'Audience',
      audienceType: 'Catholic pilgrims and devotees of Our Lady of Garabandal',
    },
    keywords: 'Catholic Marian pilgrimage, Garabandal, Our Lady, Fatima, apostolate, pilgrimage 2026',
    about: [
      'Our Lady of Garabandal',
      'Catholic Marian pilgrimages',
      'Iberian Catholic shrines',
      'Catholic spiritual life',
    ],
    offers: pilgrimage.base_price
      ? {
        '@type': 'Offer',
        price: pilgrimage.base_price,
        priceCurrency: 'EUR',
        url: pageUrl,
        availability,
        seller: { '@id': ORGANIZATION_ID },
        validThrough: pilgrimage.registration_deadline || undefined,
      }
      : undefined,
  };

  const tripSchema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${pageUrl}#trip`,
    name: title,
    description,
    image: images,
    url: pageUrl,
    provider: { '@id': ORGANIZATION_ID },
    touristType: 'Catholic pilgrims',
    itinerary,
    departureTime: pilgrimage.start_date || undefined,
    arrivalTime: pilgrimage.end_date || undefined,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${APP_URL}/en` },
      { '@type': 'ListItem', position: 2, name: 'Pilgrimages', item: `${APP_URL}/en/pilgrimages` },
      { '@type': 'ListItem', position: 3, name: title, item: pageUrl },
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
