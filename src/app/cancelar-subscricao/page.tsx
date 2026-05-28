import { supabaseServer } from '../../lib/supabase';
import { decodeUnsubscribeEmail, verifyUnsubscribeToken } from '../../lib/unsubscribe-token';
import { applyMarketingUnsubscribe } from '../../lib/marketing-unsubscribe';
import UnsubscribeResult from '../../components/marketing/UnsubscribeResult';

export const dynamic = 'force-dynamic';

export default async function CancelarSubscricaoPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e = '', t = '' } = await searchParams;
  const email = decodeUnsubscribeEmail(e);

  let status: 'success' | 'invalid' | 'error' = 'invalid';
  if (email && verifyUnsubscribeToken(email, t) && supabaseServer) {
    const result = await applyMarketingUnsubscribe(supabaseServer, email);
    status = result.ok ? 'success' : 'error';
  }

  return <UnsubscribeResult status={status} locale="pt" />;
}
