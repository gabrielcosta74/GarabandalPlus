import { supabaseServer } from '../../../../lib/supabase';
import {
  getPublicSiteUrl,
  mobileSuccess,
  publicCacheHeaders,
} from '../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  const dataAvailable = Boolean(supabaseServer);

  return mobileSuccess(
    {
      readOnly: true,
      authentication: {
        bearer: true,
        provider: 'supabase',
      },
      features: {
        pilgrimages: { available: dataAvailable, authentication: 'public' },
        pilgrimageDetails: { available: dataAvailable, authentication: 'public' },
        pilgrimageBookings: { available: dataAvailable, authentication: 'required' },
        donationHistory: { available: dataAvailable, authentication: 'required' },
      },
      payments: {
        mode: 'external',
        inAppCheckoutAvailable: false,
        donationsUrl: `${siteUrl}/donations`,
        pilgrimageUrlTemplate: `${siteUrl}/peregrinacoes/{slug}`,
      },
    },
    { headers: publicCacheHeaders, meta: { readOnly: true } },
  );
}
