import MarketingContactDetailClient from './MarketingContactDetailClient';

export default async function AdminMarketingContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketingContactDetailClient id={id} />;
}
