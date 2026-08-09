type ContentSecurityPolicyOptions = {
  development: boolean;
};

export function getContentSecurityPolicy({development}: ContentSecurityPolicyOptions) {
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com https://lh3.googleusercontent.com https://profile.line-scdn.net https://ui-avatars.com",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ['upgrade-insecure-requests']),
    'report-uri /csp-report'
  ].join('; ');
}
