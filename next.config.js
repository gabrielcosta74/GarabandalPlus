const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
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
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Robots-Tag', value: 'index, follow, max-image-preview:large' },
        ],
      },
    ];
  },
  images: {
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
