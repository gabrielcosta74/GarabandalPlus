/**
 * Central configuration for environment-dependent URLs
 * This ensures consistency across API routes, frontend, and emails
 */

// Primary application URL (for magic links, redirects, etc.)
const normalizeUrl = (value?: string | null) => value?.replace(/\/+$/, '');

export const CANONICAL_APP_URL = 'https://apostoladodegarabandal.com';

function isLocalUrl(value: string) {
    try {
        const hostname = new URL(value).hostname.toLowerCase();
        return hostname === 'localhost'
            || hostname === '127.0.0.1'
            || hostname === '::1'
            || hostname.endsWith('.localhost');
    } catch {
        return true;
    }
}

/**
 * Password-recovery emails must always open on a public, stable host. This is
 * intentionally separate from APP_URL: local development legitimately uses
 * localhost for the UI, but a real email must never contain a loopback URL.
 */
export function resolveAuthPublicUrl(authPublicUrl?: string | null, appUrl?: string | null) {
    for (const candidate of [authPublicUrl, appUrl]) {
        const normalized = normalizeUrl(candidate);
        if (normalized && !isLocalUrl(normalized)) return normalized;
    }
    return CANONICAL_APP_URL;
}

export const APP_URL =
    normalizeUrl(process.env.APP_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    (process.env.NODE_ENV === 'production'
        ? CANONICAL_APP_URL
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');

export const AUTH_PUBLIC_URL = resolveAuthPublicUrl(
    process.env.AUTH_PUBLIC_URL,
    process.env.APP_URL,
);

// Static assets hosted on main site (images, PDFs)
export const ASSETS_URL = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://apostoladodegarabandal.com';

// Helper to ensure no trailing slash
export const getAppUrl = () => APP_URL;
export const getAuthPublicUrl = () => AUTH_PUBLIC_URL;
export const getAssetsUrl = () => ASSETS_URL.replace(/\/$/, '');
