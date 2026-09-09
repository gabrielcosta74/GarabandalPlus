import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '../../../lib/supabase';
import CheckinForm from './CheckinForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dados para check-in',
  robots: { index: false, follow: false },
};

function formatDateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatter.format(new Date(start))} a ${formatter.format(new Date(end))}`;
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

  return <CheckinForm slug={data.slug} title={data.title} dateLabel={formatDateRange(data.start_date, data.end_date)} />;
}
