import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';
import { supabaseServer } from '../../../lib/supabase';

type Props = {
  params: { slug: string };
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
  const url = `${APP_URL}/peregrinacoes/${params.slug}`;
  const fallbackTitle = `Peregrinação ${slugToTitle(params.slug)} | Apostolado de Garabandal`;
  const fallbackDescription = 'Detalhes da peregrinação organizada pelo Apostolado de Garabandal.';

  if (!supabaseServer) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: url },
    };
  }

  try {
    const data = await fetchPilgrimage(params.slug);

    const title = data?.title ? `${data.title} | Apostolado de Garabandal` : fallbackTitle;
    const description = data?.description || fallbackDescription;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        url,
        title,
        description,
        images: data?.cover_image ? [data.cover_image] : undefined,
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
  const pilgrimage = await fetchPilgrimage(params.slug);

  if (!pilgrimage) {
    return children;
  }

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: pilgrimage.title || 'Peregrinação',
    description: pilgrimage.description || undefined,
    startDate: pilgrimage.start_date || undefined,
    endDate: pilgrimage.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    image: pilgrimage.cover_image ? [pilgrimage.cover_image] : undefined,
    organizer: {
      '@type': 'Organization',
      name: 'Apostolado de Garabandal',
      url: APP_URL,
    },
    offers: pilgrimage.base_price
      ? {
        '@type': 'Offer',
        price: pilgrimage.base_price,
        priceCurrency: 'EUR',
        url: `${APP_URL}/peregrinacoes/${params.slug}`,
        availability: 'https://schema.org/InStock',
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
        item: `${APP_URL}/peregrinacoes/${params.slug}`,
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
