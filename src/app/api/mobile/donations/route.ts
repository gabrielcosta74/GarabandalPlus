import { supabaseServer } from '../../../../lib/supabase';
import {
  authenticateMobileMember,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DONATION_FIELDS = 'id,amount_cents,currency,created_at,description,status,method';

export async function GET(request: Request) {
  const auth = await authenticateMobileMember(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const byUser = supabaseServer
    .from('donations')
    .select(DONATION_FIELDS)
    .eq('user_id', auth.identity.userId)
    .neq('status', 'failed')
    .order('created_at', { ascending: false });

  const [byUserResult, byEmailResult] = await Promise.all([
    byUser,
    auth.identity.email
      ? supabaseServer
          .from('donations')
          .select(DONATION_FIELDS)
          .ilike('donor_email', auth.identity.email)
          .neq('status', 'failed')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const queryError = byUserResult.error || byEmailResult.error;
  if (queryError) {
    console.error('[mobile/donations] Failed to load member donations:', queryError);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar os donativos.');
  }

  const donationsById = new Map<string, Record<string, unknown>>();
  for (const donation of [...(byUserResult.data ?? []), ...(byEmailResult.data ?? [])]) {
    donationsById.set(String(donation.id), donation);
  }

  const donations = [...donationsById.values()].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  );
  const succeeded = donations.filter((donation) => donation.status === 'succeeded');
  const totalContributedCents = succeeded.reduce(
    (sum, donation) => sum + (Number(donation.amount_cents) || 0),
    0,
  );

  return mobileSuccess(
    {
      summary: {
        currency: 'EUR',
        succeededCount: succeeded.length,
        totalContributedCents,
      },
      donations,
    },
    {
      headers: privateCacheHeaders,
      meta: { count: donations.length, readOnly: true },
    },
  );
}
