type ContentSecurityPolicyOptions = {
  development: boolean;
  sentryDsn?: string;
};

function getOrigin(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function getContentSecurityPolicy({development, sentryDsn}: ContentSecurityPolicyOptions) {
  const sentryOrigin = getOrigin(sentryDsn);
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com https://lh3.googleusercontent.com https://profile.line-scdn.net https://ui-avatars.com",
    "font-src 'self'",
    `connect-src 'self'${sentryOrigin ? ` ${sentryOrigin}` : ''}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'report-uri /csp-report'
  ].join('; ');
}
