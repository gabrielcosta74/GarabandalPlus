/**
 * Central configuration for environment-dependent URLs
 * This ensures consistency across API routes, frontend, and emails
 */

// Primary application URL (for magic links, redirects, etc.)
const normalizeUrl = (value?: string | null) => value?.replace(/\/+$/, '');

export const APP_URL =
    normalizeUrl(process.env.APP_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    (process.env.NODE_ENV === 'production'
        ? 'https://apostoladodegarabandal.com'
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');

// Static assets hosted on main site (images, PDFs)
export const ASSETS_URL = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://apostoladodegarabandal.com';

// Helper to ensure no trailing slash
export const getAppUrl = () => APP_URL;
export const getAssetsUrl = () => ASSETS_URL.replace(/\/$/, '');
