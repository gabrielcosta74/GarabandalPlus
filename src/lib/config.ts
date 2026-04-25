/**
 * Central configuration for environment-dependent URLs
 * This ensures consistency across API routes, frontend, and emails
 */

// Primary application URL (for magic links, redirects, etc.)
export const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://app.apostoladodegarabandal.com'
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');

// Static assets hosted on main site (images, PDFs)
export const ASSETS_URL = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://apostoladodegarabandal.com';

// Helper to ensure no trailing slash
export const getAppUrl = () => APP_URL.replace(/\/$/, '');
export const getAssetsUrl = () => ASSETS_URL.replace(/\/$/, '');
