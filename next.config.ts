import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Vercel refuse les corps de requête au-delà de ~4,5 Mo : rester en deçà.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};

export default withNextIntl(nextConfig);
