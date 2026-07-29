export function accountProxyRewrites(target: string | undefined) {
  if (!target) return [];
  return [{
    source: '/api/account/:path*',
    destination: `${target.replace(/\/$/, '')}/api/account/:path*`
  }];
}
