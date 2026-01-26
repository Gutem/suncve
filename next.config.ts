import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages (change 'suncve' to your repo name)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist'],
  // Mark sql.js as external to prevent bundling issues with Node.js modules
  serverExternalPackages: ['sql.js'],
  // Trailing slash for GitHub Pages compatibility
  trailingSlash: true,
  // Empty turbopack config to silence the warning about webpack config
  turbopack: {}
};

export default withNextIntl(baseConfig);
