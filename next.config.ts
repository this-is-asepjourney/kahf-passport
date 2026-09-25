import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Removed output: 'standalone' for native Vercel deployment

  // Enable PWA-like features
  poweredByHeader: false,

  // Image optimization config
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },

  // Env validation
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  },

  // Transpile Firebase packages for SSR
  transpilePackages: ['firebase', 'react-qr-code'],

  // Empty turbopack config (html5-qrcode is imported dynamically in browser-only code)
  turbopack: {},
};

export default nextConfig;
