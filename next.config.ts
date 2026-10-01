import createNextIntlPlugin from 'next-intl/plugin';
import type {NextConfig} from 'next';
import {accountProxyRewrites} from './src/lib/account-proxy';
import {getContentSecurityPolicy} from './src/lib/csp';
import weeklyTemplate from './public/assets/weekly/v1/manifest.json';

const reportOnlyCsp = getContentSecurityPolicy({
  development: process.env.NODE_ENV !== 'production',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN
});
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

const nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: uploadSourceMaps,
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
  headers: async () => [
    {source: '/:locale/literature-ministry/offline/reader-shell', headers: [{key: 'X-HHC-Reader-Shell', value: 'public'}, {key: 'X-Robots-Tag', value: 'noindex, nofollow'}]},
    ...weeklyTemplate.assets.map(asset => ({source: asset.url, headers: [{key: 'Cache-Control', value: 'public, max-age=31536000, immutable'}]})),
    {source: '/assets/weekly/v1/manifest.json', headers: [{key: 'Cache-Control', value: 'public, max-age=0, must-revalidate'}]},
    {source: '/:locale/statements/:slug', headers: [{key: 'X-Robots-Tag', value: 'noindex, follow'}]}, {
    source: '/(.*)',
    headers: [{key: 'Content-Security-Policy', value: reportOnlyCsp}]
  }],
  rewrites: async () => [
    ...accountProxyRewrites(process.env.ACCOUNT_API_PROXY_TARGET),
    ...(process.env.NODE_ENV === 'development' && process.env.HHC_WEB_API_BASE_URL ? [{source: '/api/statements/active', destination: `${process.env.HHC_WEB_API_BASE_URL.replace(/\/$/, '')}/statements/active`}] : [])
  ]
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
