export function accountSiteUrlForBrowser() {
  const configured = process.env.NEXT_PUBLIC_ACCOUNT_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window === 'undefined') return 'https://account.alive.org.tw';
  if (window.location.hostname === 'www-test.alive.org.tw') return 'https://account-test.alive.org.tw';
  if (window.location.hostname === 'www.alive.org.tw') return 'https://account.alive.org.tw';
  return 'http://localhost:5173';
}

export function accountAuthorizeBaseUrlForBrowser() {
  const configured = process.env.NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL?.replace(/\/$/, '');
  return configured ?? `${accountSiteUrlForBrowser()}/api/account/v1`;
}

export function accountSessionBaseUrlForBrowser() {
  return '/api/account/v1';
}
