import createNextIntlPlugin from 'next-intl/plugin';
import type {NextConfig} from 'next';
import path from 'node:path';
import {accountProxyRewrites} from './src/lib/account-proxy';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  allowedDevOrigins: ['www.hhc.test'],
  rewrites: async () => accountProxyRewrites(process.env.ACCOUNT_API_PROXY_TARGET),
  images: {
    unoptimized: true
  }
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
