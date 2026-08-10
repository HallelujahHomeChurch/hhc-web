import {describe, expect, it} from 'vitest';
import {getContentSecurityPolicy} from './csp';

function directive(policy: string, name: string) {
  return policy.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name} `));
}

describe('getContentSecurityPolicy', () => {
  it('sets a cache-compatible report-only baseline for executable content', () => {
    const policy = getContentSecurityPolicy({development: false});

    expect(directive(policy, 'default-src')).toBe("default-src 'none'");
    expect(directive(policy, 'script-src')).toBe("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain('nonce-');
    expect(directive(policy, 'object-src')).toBe("object-src 'none'");
    expect(directive(policy, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(policy, 'form-action')).toBe("form-action 'self'");
    expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(policy, 'frame-src')).toBe("frame-src 'none'");
    expect(directive(policy, 'media-src')).toBe("media-src 'none'");
  });

  it('allows only current public application dependencies', () => {
    const policy = getContentSecurityPolicy({development: false});

    expect(directive(policy, 'img-src')).toBe("img-src 'self' data: blob: https://i.ytimg.com https://lh3.googleusercontent.com https://profile.line-scdn.net https://ui-avatars.com");
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(policy, 'font-src')).toBe("font-src 'self'");
    expect(directive(policy, 'worker-src')).toBe("worker-src 'self' blob:");
    expect(directive(policy, 'style-src-elem')).toBe("style-src-elem 'self' 'unsafe-inline'");
    expect(directive(policy, 'style-src-attr')).toBe("style-src-attr 'unsafe-inline'");
    expect(policy).not.toContain('upgrade-insecure-requests');
    expect(policy).toContain('report-uri /csp-report');
  });

  it('adds eval only for local React development tooling', () => {
    expect(directive(getContentSecurityPolicy({development: true}), 'script-src')).toBe(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    );
    expect(getContentSecurityPolicy({development: true})).not.toContain('upgrade-insecure-requests');
  });

  it('adds only the exact Sentry ingest origin', () => {
    const policy = getContentSecurityPolicy({
      development: false,
      sentryDsn: 'https://public-key@o123.ingest.us.sentry.io/456'
    });

    expect(directive(policy, 'connect-src')).toBe("connect-src 'self' https://o123.ingest.us.sentry.io");
    expect(policy).not.toContain('public-key');
    expect(policy).not.toContain('/456');
  });
});
