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
  const reduniqAvailable = Boolean(
    process.env.REDUNIQ_API_USER
    && process.env.REDUNIQ_API_PASSWORD
    && process.env.REDUNIQ_API_ENDPOINT,
  );
  const mobileCheckoutEnabled = process.env.MOBILE_PILGRIMAGE_CHECKOUT_ENABLED === 'true';
  const pilgrimageCheckoutAvailable = dataAvailable && reduniqAvailable && mobileCheckoutEnabled;

  return mobileSuccess(
    {
      readOnly: !dataAvailable,
      authentication: {
        bearer: true,
        provider: 'supabase',
      },
      features: {
        pilgrimages: { available: dataAvailable, authentication: 'public' },
        pilgrimageDetails: { available: dataAvailable, authentication: 'public' },
        pilgrimageBookings: { available: dataAvailable, authentication: 'required' },
        pilgrimageBookingCreation: { available: dataAvailable, authentication: 'required' },
        pilgrimageRegistration: { available: dataAvailable, authentication: 'required' },
        nativeRegistration: { available: dataAvailable, authentication: 'required' },
        pilgrimageBookingDetails: { available: dataAvailable, authentication: 'required' },
        pilgrimageBookingManagement: { available: dataAvailable, authentication: 'required' },
        pilgrimageWaitlist: { available: dataAvailable, authentication: 'optional' },
        pilgrimageCheckout: {
          available: pilgrimageCheckoutAvailable,
          authentication: 'required',
          mode: 'external',
        },
        pilgrimagePasses: { available: dataAvailable, authentication: 'required' },
        externalReduniqCheckout: {
          available: pilgrimageCheckoutAvailable,
          authentication: 'required',
          mode: 'external',
        },
        donationHistory: { available: dataAvailable, authentication: 'required' },
      },
      payments: {
        mode: 'external',
        inAppCheckoutAvailable: false,
        externalPilgrimageCheckoutAvailable: pilgrimageCheckoutAvailable,
        donationsUrl: `${siteUrl}/donations`,
        pilgrimageUrlTemplate: `${siteUrl}/peregrinacoes/{slug}`,
      },
    },
    { headers: publicCacheHeaders, meta: { readOnly: !dataAvailable } },
  );
}
