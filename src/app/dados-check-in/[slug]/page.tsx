import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '../../../lib/supabase';
import CheckinForm from './CheckinForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dados para check-in / Hotel check-in details',
  robots: { index: false, follow: false },
};

const englishTitles: Record<string, string> = {
  'peregrinacao-iberica-2026': 'Pilgrimage to Garabandal - Marian Route - October 2026',
  'peregrinacao-iberico-novembro-2026': 'Pilgrimage to Garabandal - Iberian Route - November 2026',
};

function formatDateRange(start: string, end: string) {
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  };
  const portugueseFormatter = new Intl.DateTimeFormat('pt-PT', dateOptions);
  const englishFormatter = new Intl.DateTimeFormat('en-GB', dateOptions);
  const startDate = new Date(start);
  const endDate = new Date(end);

  return `${portugueseFormatter.format(startDate)} a ${portugueseFormatter.format(endDate)} / ${englishFormatter.format(startDate)} to ${englishFormatter.format(endDate)}`;
}

export default async function CheckinPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!supabaseServer) notFound();
  const { slug } = await params;
  const { data } = await supabaseServer
    .from('pilgrimages')
    .select('title, start_date, end_date, slug, checkin_form_enabled')
    .eq('slug', slug)
    .eq('checkin_form_enabled', true)
    .maybeSingle();

  if (!data) notFound();

  return (
    <CheckinForm
      slug={data.slug}
      title={data.title}
      englishTitle={englishTitles[data.slug] ?? 'Pilgrimage to Garabandal'}
      dateLabel={formatDateRange(data.start_date, data.end_date)}
    />
  );
}
