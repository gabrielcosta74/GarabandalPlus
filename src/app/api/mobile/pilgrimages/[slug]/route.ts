import { supabaseServer } from '../../../../../lib/supabase';
import {
  getMobileLocale,
  isSafeSlug,
  mobileError,
  mobileSuccess,
  publicCacheHeaders,
} from '../../_lib/server';
import {
  isMobilePublicPilgrimage,
  serializeLocalizedChild,
  serializePilgrimage,
} from '../../_lib/pilgrimages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const { slug } = await params;
  if (!isSafeSlug(slug)) {
    return mobileError(400, 'invalid_request', 'Identificador de peregrinação inválido.');
  }

  const locale = getMobileLocale(request);
  const { data: pilgrimage, error: pilgrimageError } = await supabaseServer
    .rpc('get_pilgrimage_list', { p_slug: slug })
    .maybeSingle();

  if (pilgrimageError) {
    console.error('[mobile/pilgrimages/:slug] Failed to load pilgrimage:', pilgrimageError);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar a peregrinação.');
  }

  const pilgrimageRow = pilgrimage as Record<string, unknown> | null;
  if (!pilgrimageRow || !isMobilePublicPilgrimage(pilgrimageRow)) {
    return mobileError(404, 'not_found', 'Peregrinação não encontrada.', publicCacheHeaders);
  }

  const pilgrimageId = String(pilgrimageRow.id);
  const [stagesResult, itineraryResult, teamResult] = await Promise.all([
    supabaseServer
      .from('pilgrimage_stages')
      .select('id,title,description,lat,lng,image_url,display_order')
      .eq('pilgrimage_id', pilgrimageId)
      .order('display_order', { ascending: true }),
    supabaseServer
      .from('pilgrimage_itinerary_items')
      .select('id,day_number,title,title_en,description,description_en,image_url,display_order')
      .eq('pilgrimage_id', pilgrimageId)
      .order('day_number', { ascending: true }),
    supabaseServer
      .from('pilgrimage_team_members')
      .select('id,name,role,role_en,country,image_url,is_special_guest,description,description_en,display_order')
      .eq('pilgrimage_id', pilgrimageId)
      .order('display_order', { ascending: true }),
  ]);

  const relatedError = stagesResult.error || itineraryResult.error || teamResult.error;
  if (relatedError) {
    console.error('[mobile/pilgrimages/:slug] Failed to load related content:', relatedError);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar os detalhes da peregrinação.');
  }

  return mobileSuccess(
    {
      pilgrimage: serializePilgrimage(pilgrimageRow, locale),
      stages: stagesResult.data ?? [],
      itinerary: (itineraryResult.data ?? []).map((row) =>
        serializeLocalizedChild(row, locale, ['title', 'description']),
      ),
      team: (teamResult.data ?? []).map((row) =>
        serializeLocalizedChild(row, locale, ['role', 'description']),
      ),
    },
    { headers: publicCacheHeaders, meta: { locale, readOnly: true } },
  );
}
