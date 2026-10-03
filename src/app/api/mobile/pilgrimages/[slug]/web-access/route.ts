import { createHash, randomBytes } from 'node:crypto';
import { CANONICAL_APP_URL } from '../../../../../../lib/config';
import { checkRateLimit } from '../../../../../../lib/rate-limit';
import { supabaseServer } from '../../../../../../lib/supabase';
import {
  authenticateMobileUser,
  getMobileLocale,
  isSafeSlug,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (process.env.MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED !== 'true') {
    return mobileError(503, 'not_configured', 'A passagem para o site ainda não está disponível.');
  }
  const auth = await authenticateMobileUser(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');

  const limit = checkRateLimit(request, { keyPrefix: `mobile-pilgrimage-web-access:${auth.identity.userId}`, windowMs: 60_000, max: 8 });
  if (!limit.allowed) return mobileError(429, 'rate_limited', 'Tente novamente dentro de um minuto.');

  const { slug } = await params;
  if (!isSafeSlug(slug)) return mobileError(400, 'invalid_request', 'Peregrinação inválida.');
  const { data: pilgrimage, error: pilgrimageError } = await supabaseServer
    .from('pilgrimages')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();
  if (pilgrimageError) return mobileError(502, 'upstream_error', 'Não foi possível verificar a peregrinação.');
  if (!pilgrimage) return mobileError(404, 'not_found', 'Peregrinação não encontrada.');

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 3 * 60_000).toISOString();
  const { error } = await supabaseServer.from('mobile_booking_web_handoffs').insert({
    token_hash: createHash('sha256').update(token).digest('hex'),
    pilgrimage_slug: slug,
    user_id: auth.identity.userId,
    locale: getMobileLocale(request),
    expires_at: expiresAt,
  });
  if (error) {
    console.error('[mobile/pilgrimage-web-access] Could not create handoff:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível abrir a inscrição no site.');
  }

  const url = new URL('/api/booking/mobile-handoff', `${CANONICAL_APP_URL}/`);
  url.searchParams.set('token', token);
  return mobileSuccess({ url: url.toString(), expiresAt }, { headers: privateCacheHeaders });
}
