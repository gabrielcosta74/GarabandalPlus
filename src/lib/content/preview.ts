import { cookies } from 'next/headers';
import { isAdminEmail } from '../cms/authz';
import { createServerClient } from '@supabase/ssr';
import type { ContentStatus } from './queries';

const PREVIEW_COOKIE = 'cms-preview';

/**
 * What the PUBLIC routes are allowed to render. A plain constant, deliberately
 * not a function.
 *
 * `getPublicStatuses()` reads `cookies()`, which is a dynamic API: any route
 * that calls it is rendered per request. Because every content page called it,
 * all ~1500 public URLs were served `cache-control: no-store`, their
 * `export const revalidate` never applied, and Googlebot paid a full server
 * render on every crawl (field TTFB 1.2s).
 *
 * Public routes therefore use this constant and stay static/ISR. Drafts are
 * viewed through /preview/... instead — see src/app/preview/[[...path]]/page.tsx.
 */
export const PUBLISHED_ONLY: ContentStatus[] = ['published'];

/** Statuses an authenticated admin may see in the preview route. */
export const PREVIEW_STATUSES: ContentStatus[] = ['published', 'draft', 'scheduled'];

/**
 * Determine whether the current request should see drafts.
 *
 * A request is in preview mode when BOTH:
 *   - The `cms-preview` cookie is set with value '1'
 *   - The request has a Supabase session whose email is in the admin allow-list
 *
 * The cookie alone is not enough — admin auth is required so a leaked cookie
 * cannot expose drafts publicly.
 *
 * Returns the list of statuses the public queries should accept.
 */
export async function getPublicStatuses(): Promise<ContentStatus[]> {
  // Dev-only convenience: with CMS_PREVIEW_ALL=1 in .env.local you can browse
  // ALL content (incl. drafts) on localhost without logging in. Double-gated —
  // the NODE_ENV check means it is IGNORED in production builds, so it can
  // never leak drafts on the live site even if the var is set there.
  if (process.env.NODE_ENV !== 'production' && process.env.CMS_PREVIEW_ALL === '1') {
    return ['published', 'draft', 'scheduled'];
  }
  if (!(await isPreviewSession())) return ['published'];
  return ['published', 'draft', 'scheduled'];
}

export async function isPreviewSession(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(PREVIEW_COOKIE)?.value !== '1') return false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const ssr = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });
    const { data: { user } } = await ssr.auth.getUser();
    return isAdminEmail(user?.email);
  } catch {
    return false;
  }
}

export const PREVIEW_COOKIE_NAME = PREVIEW_COOKIE;
