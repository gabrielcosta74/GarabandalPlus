import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { supabaseServer } from '../supabase';

/**
 * Returns the list of admin emails from env vars, lower-cased.
 * Reads ADMIN_EMAIL (single) and ADMIN_EMAILS (comma-separated).
 */
export function getAdminEmails(): string[] {
  return [
    process.env.ADMIN_EMAIL,
    ...(process.env.ADMIN_EMAILS || '').split(','),
  ]
    .map((e) => (e ?? '').trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

type AdminUser = { id: string; email: string };

/**
 * Server Component / Server Action guard. Reads the auth session from cookies,
 * verifies the JWT against Supabase, and confirms the email is in the
 * admin allow-list. Throws redirect to /admin (login page) if not authorized.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  const hdrs = await headers();
  const authHeader = hdrs.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const ssr = createServerClient(supabaseUrl, supabaseAnonKey, {
    global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const { data: { user } } = await ssr.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    redirect('/admin');
  }
  return { id: user.id, email: user.email };
}

/**
 * For API routes / server actions that receive a Bearer token directly.
 * Returns null if not authorized; never throws.
 */
export async function verifyAdminToken(token: string): Promise<AdminUser | null> {
  if (!supabaseServer || !token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user?.email) return null;
  if (!isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}
