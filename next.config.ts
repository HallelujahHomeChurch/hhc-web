import createNextIntlPlugin from 'next-intl/plugin';
import type {NextConfig} from 'next';
import {accountProxyRewrites} from './src/lib/account-proxy';
import {getContentSecurityPolicy} from './src/lib/csp';

const reportOnlyCsp = getContentSecurityPolicy({development: process.env.NODE_ENV !== 'production'});

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  allowedDevOrigins: ['www.hhc.test'],
  images: {
    minimumCacheTTL: 86_400,
    qualities: [70, 75],
    remotePatterns: [
      {protocol: 'https', hostname: 'www.alive.org.tw', pathname: '/assets/**'},
      {protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**'}
    ]
  },
  headers: async () => [{
    source: '/(.*)',
    headers: [{key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp}]
  }],
  rewrites: async () => accountProxyRewrites(process.env.ACCOUNT_API_PROXY_TARGET)
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
