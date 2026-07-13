import {describe, expect, it} from 'vitest';
import {accountProxyRewrites} from './account-proxy';

describe('accountProxyRewrites', () => {
  it('is disabled unless a local proxy target is configured', () => {
    expect(accountProxyRewrites(undefined)).toEqual([]);
  });

  it('proxies account routes without duplicating a trailing slash', () => {
    expect(accountProxyRewrites('http://127.0.0.1:8080/')).toEqual([{
      source: '/api/account/:path*',
      destination: 'http://127.0.0.1:8080/api/account/:path*'
    }]);
  });
});
