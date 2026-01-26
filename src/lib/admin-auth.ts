import { supabaseServer } from './supabase';

/**
 * Verifies if the request is authenticated by a valid Admin.
 * Checks for:
 * 1. Valid Supabase Session (Bearer Token)
 * 2. User Email matches ADMIN_EMAIL or ADMIN_EMAILS env vars.
 */
export async function verifyAdmin(req: Request): Promise<{ authorized: boolean; user?: any; error?: string }> {
  try {
    if (!supabaseServer) return { authorized: false, error: 'Server Config Error' };

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return { authorized: false, error: 'Missing Authorization Header' };

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return { authorized: false, error: 'Empty Token' };

    const { data: { user }, error } = await supabaseServer.auth.getUser(token);

    if (error || !user || !user.email) {
      return { authorized: false, error: 'Invalid Session' };
    }

    // Check against allowed emails
    const allowedEmails = [
      process.env.ADMIN_EMAIL,
      ...(process.env.ADMIN_EMAILS || '').split(',')
    ]
      .filter(Boolean)
      .map(e => e?.trim().toLowerCase());

    if (allowedEmails.includes(user.email.toLowerCase())) {
      return { authorized: true, user };
    }

    return { authorized: false, error: 'Forbidden: Not an Admin' };

  } catch (e) {
    console.error('Admin verification exception:', e);
    return { authorized: false, error: 'Internal Error' };
  }
}
