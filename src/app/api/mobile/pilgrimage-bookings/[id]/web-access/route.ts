import { createHash, randomBytes } from 'node:crypto';
import { getAppUrl } from '../../../../../../lib/config';
import { checkRateLimit } from '../../../../../../lib/rate-limit';
import { supabaseServer } from '../../../../../../lib/supabase';
import {
  authenticateMobileUser,
  getMobileLocale,
  isSafeUuid,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED !== 'true') {
    return mobileError(503, 'not_configured', 'A passagem para o site ainda não está disponível.');
  }
  const auth = await authenticateMobileUser(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');

  const limit = checkRateLimit(request, { keyPrefix: `mobile-booking-web-access:${auth.identity.userId}`, windowMs: 60_000, max: 8 });
  if (!limit.allowed) return mobileError(429, 'rate_limited', 'Tente novamente dentro de um minuto.');

  const { id } = await params;
  if (!isSafeUuid(id)) return mobileError(400, 'invalid_request', 'Identificador de inscrição inválido.');
  const { data: booking, error: bookingError } = await supabaseServer
    .from('bookings')
    .select('id,status')
    .eq('id', id)
    .eq('user_id', auth.identity.userId)
    .maybeSingle();
  if (bookingError) return mobileError(502, 'upstream_error', 'Não foi possível verificar a inscrição.');
  if (!booking || booking.status === 'canceled') return mobileError(404, 'not_found', 'Inscrição não encontrada.');

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const locale = getMobileLocale(request);
  const expiresAt = new Date(Date.now() + 3 * 60_000).toISOString();
  const { error } = await supabaseServer.from('mobile_booking_web_handoffs').insert({
    token_hash: tokenHash,
    booking_id: id,
    user_id: auth.identity.userId,
    locale,
    expires_at: expiresAt,
  });
  if (error) {
    console.error('[mobile/web-access] Could not create handoff:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível abrir a inscrição no site.');
  }

  const url = new URL('/api/booking/mobile-handoff', `${getAppUrl()}/`);
  url.searchParams.set('token', token);
  return mobileSuccess({ url: url.toString(), expiresAt }, { headers: privateCacheHeaders });
}
