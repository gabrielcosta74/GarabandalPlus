import { supabaseServer } from './supabase';

export type SiteTrackingIds = { visitorId: string; sessionId: string };

const ID_PATTERN = /^(s:)?[A-Za-z0-9-]{8,64}$/;

export function parseSiteTrackingIds(raw: unknown): SiteTrackingIds | null {
  if (!raw || typeof raw !== 'object') return null;
  const { visitorId, sessionId } = raw as Record<string, unknown>;
  if (typeof visitorId !== 'string' || typeof sessionId !== 'string') return null;
  if (!ID_PATTERN.test(visitorId) || !ID_PATTERN.test(sessionId)) return null;
  return { visitorId, sessionId };
}

/**
 * Liga o visitante do tracking próprio a uma pessoa (lead, inscrição, conta).
 * Nunca lança: falhar o tracking não pode afetar o lead nem a inscrição.
 */
export async function identifySiteVisitor(
  raw: unknown,
  identity: { email?: string | null; leadId?: string | null; bookingId?: string | null; userId?: string | null },
) {
  const ids = parseSiteTrackingIds(raw);
  if (!ids || !supabaseServer) return;
  try {
    const { error } = await supabaseServer.rpc('site_identify', {
      p_visitor_id: ids.visitorId,
      p_session_id: ids.sessionId,
      p_email: identity.email || null,
      p_lead_id: identity.leadId || null,
      p_booking_id: identity.bookingId || null,
      p_user_id: identity.userId || null,
    });
    if (error) console.warn('[site-track] identify failed:', error.message);
  } catch (err) {
    console.warn('[site-track] identify failed:', err);
  }
}
