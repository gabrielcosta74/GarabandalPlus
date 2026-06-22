import { supabaseBrowser } from './supabase-browser';

/**
 * Lightweight, fire-and-forget telemetry for the members area.
 * Rows are inserted directly via the browser client; RLS (member_activity_insert_own)
 * guarantees a member can only write their own rows. All reads happen admin-side.
 */

export type MemberFeature =
  | 'dashboard'
  | 'novenas'
  | 'cursos'
  | 'documentos'
  | 'velas'
  | 'prayers'
  | 'live'
  | 'quota'
  | 'profile'
  | 'espiritualidade'
  | 'calendar'
  | 'history'
  | 'academy'
  | 'direitos-deveres'
  | 'content_view'
  | 'other';

export type MemberActivityEventType =
  | 'page_view'
  | 'content_view'
  | 'referral_widget_viewed'
  | 'referral_info_opened'
  | 'referral_share_clicked'
  | 'referral_native_share_completed'
  | 'referral_share_modal_opened'
  | 'referral_code_copied'
  | 'referral_message_copied'
  | 'referral_link_copied'
  | 'referral_store_cta_clicked';

type MemberActivityMetadata = Record<string, string | number | boolean | null | undefined>;

// Maps both PT (/member/...) and EN (/en/member/...) route segments to a feature key.
const SEGMENT_TO_FEATURE: Record<string, MemberFeature> = {
  novenas: 'novenas',
  cursos: 'cursos',
  academy: 'academy',
  documentos: 'documentos',
  documents: 'documentos',
  velas: 'velas',
  candles: 'velas',
  prayers: 'prayers',
  live: 'live',
  quota: 'quota',
  profile: 'profile',
  espiritualidade: 'espiritualidade',
  spirituality: 'espiritualidade',
  calendar: 'calendar',
  history: 'history',
  'direitos-deveres': 'direitos-deveres',
  'rights-duties': 'direitos-deveres',
};

/** Derives a stable feature key from a /member or /en/member pathname. */
export function deriveFeature(pathname: string): MemberFeature {
  const parts = pathname.split('?')[0].split('/').filter(Boolean); // strip query + empties
  const memberIdx = parts.indexOf('member');
  if (memberIdx === -1) return 'other';
  const segment = parts[memberIdx + 1];
  if (!segment) return 'dashboard'; // /member or /en/member root
  return SEGMENT_TO_FEATURE[segment] ?? 'other';
}

const SESSION_KEY = 'ga_member_session_id';

/** Stable random id per browser tab/session, used to estimate distinct sessions. */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function localeFromPath(pathname: string): string {
  return pathname.startsWith('/en') ? 'en' : 'pt';
}

function sanitizeMetadata(metadata: MemberActivityMetadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

/** Records a member-area event. Never throws. */
export async function trackMemberEvent(
  userId: string,
  eventType: MemberActivityEventType,
  pathname: string,
  metadata: MemberActivityMetadata = {},
): Promise<void> {
  if (!supabaseBrowser || !userId) return;
  try {
    await supabaseBrowser.from('member_activity').insert({
      user_id: userId,
      path: pathname,
      feature: deriveFeature(pathname),
      event_type: eventType,
      metadata: sanitizeMetadata(metadata),
      locale: localeFromPath(pathname),
      session_id: getSessionId(),
    });
  } catch {
    /* telemetry must never break the UI */
  }
}

/** Records a page view in the members area. Never throws. */
export async function trackPageView(userId: string, pathname: string): Promise<void> {
  await trackMemberEvent(userId, 'page_view', pathname);
}

/** Records a member opening a specific private-content item. Never throws. */
export async function trackContentView(
  userId: string,
  contentId: string,
  pathname: string
): Promise<void> {
  if (!supabaseBrowser || !userId || !contentId) return;
  try {
    await supabaseBrowser.from('member_activity').insert({
      user_id: userId,
      path: pathname,
      feature: 'content_view',
      event_type: 'content_view',
      content_id: contentId,
      metadata: {},
      locale: localeFromPath(pathname),
      session_id: getSessionId(),
    });
  } catch {
    /* telemetry must never break the UI */
  }
}

/**
 * Convenience wrapper for click handlers: resolves the current user itself so
 * pages don't need to wire in the auth context. Fire-and-forget, never throws.
 */
export async function logContentView(contentId: string): Promise<void> {
  if (!supabaseBrowser || !contentId || typeof window === 'undefined') return;
  try {
    const { data } = await supabaseBrowser.auth.getUser();
    if (!data.user?.id) return;
    await trackContentView(data.user.id, contentId, window.location.pathname);
  } catch {
    /* telemetry must never break the UI */
  }
}
