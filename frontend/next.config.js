/** @type {import('next').NextConfig} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Use empty string for local dev (NEXT_PUBLIC_BASE_PATH=""), otherwise default to production path
const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
  ? process.env.NEXT_PUBLIC_BASE_PATH
  : "/us/montana-flat-tax-dashboard";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  // Locally, pin the output file tracing root to this directory so
  // lockfiles in parent directories are ignored. On Vercel the project
  // builds from the repository with `frontend` as its root directory,
  // and the builder needs the default (repository) tracing root: with
  // this set it looks for `.next` at the repository root and fails.
  ...(process.env.VERCEL ? {} : { outputFileTracingRoot: path.join(__dirname) }),
  // Allow external images from policyengine.org for optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'policyengine.org',
        pathname: '/assets/**',
      },
    ],
  },
  // Compress responses for better performance
  compress: true,
  // Enable powered-by header removal for security
  poweredByHeader: false,
  // SEO-friendly headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
