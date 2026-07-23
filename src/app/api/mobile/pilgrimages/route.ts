import { supabaseServer } from '../../../../lib/supabase';
import {
  getMobileLocale,
  mobileError,
  mobileSuccess,
  publicCacheHeaders,
} from '../_lib/server';
import { isMobilePublicPilgrimage, serializePilgrimage } from '../_lib/pilgrimages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const locale = getMobileLocale(request);
  const { data, error } = await supabaseServer.rpc('get_pilgrimage_list', { p_slug: null });

  if (error) {
    console.error('[mobile/pilgrimages] Failed to load pilgrimage list:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar as peregrinações.');
  }

  const pilgrimages = (Array.isArray(data) ? data : [])
    .filter(isMobilePublicPilgrimage)
    .map((row) => serializePilgrimage(row, locale));

  return mobileSuccess(
    { pilgrimages },
    {
      headers: publicCacheHeaders,
      meta: { locale, count: pilgrimages.length, readOnly: true },
    },
  );
}
