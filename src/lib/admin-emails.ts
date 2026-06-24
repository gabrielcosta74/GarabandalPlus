// Single source of truth for the admin allowlist.
// SECURITY: server-side access to /admin is still enforced by verifyAdmin().
// This list is also imported by client components (e.g. the header profile
// dropdown) purely to decide whether to *show* the admin shortcut — it is not
// a security boundary on its own. Keep this file free of server-only imports
// (no next/headers, no service keys) so it can be bundled on the client.
export const ADMIN_EMAILS = [
    'gabrielcosta74@gmail.com',
    'geral@apostoladodegarabandal.com',
] as const;

/**
 * Returns true when the given email belongs to an administrator.
 * Case-insensitive. Safe to call on the client.
 */
export function isAdminEmail(email?: string | null): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}
