const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Canonicalize trailing slashes in middleware so legacy `www` URLs can be
  // collapsed to the apex host and slashless path in a single 301.
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/realtime-js', 'ws'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('ws');
    }
    config.watchOptions = config.watchOptions || {};
    config.watchOptions.ignored = [
      '**/.next/**',
      '**/.next.bak.*/**',
      '**/node_modules.bak.*/**',
      '**/migration-output/**',
      '**/tmp/**',
    ];
    return config;
  },
  async headers() {
    return [
      // Note: Next.js already sets immutable caching on hashed /_next/static
      // assets. A manual Cache-Control here breaks dev HMR (Next 16 warns), so
      // we only manage caching for our own /images/* files.
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Robots-Tag', value: 'index, follow, max-image-preview:large' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/maria-sinais/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/maria-sinais/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/maria-sinais/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  images: {
    // Next 16 requires every `quality` used by <Image> to be declared here.
    qualities: [75, 85],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'myportugalholiday.com',
      },
      {
        protocol: 'https',
        hostname: '*.clvaw-cdnwnd.com',
      },
      {
        protocol: 'https',
        hostname: '**.clvaw-cdnwnd.com',
      }
    ],
  },
};

module.exports = withBundleAnalyzer(nextConfig);
