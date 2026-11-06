export function publicContentBaseUrl() {
  return privateContentBaseUrl('HHC_WEB_PUBLIC_API_BASE_URL') ?? process.env.HHC_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? 'http://127.0.0.1:8081/api';
}

export function privateContentBaseUrl(name: 'HHC_WEB_HISTORY_API_BASE_URL' | 'HHC_WEB_ABOUT_API_BASE_URL' | 'HHC_WEB_NEWS_API_BASE_URL' | 'HHC_WEB_PUBLIC_API_BASE_URL') {
  const base = process.env[name];
  if (base && !/^https:\/\/hhc-web-api\.internal\.[a-z0-9-]+\.[a-z0-9-]+\.azurecontainerapps\.io\/api$/.test(base)) {
    throw new Error(`${name} must be the internal CMS HTTPS API base`);
  }
  return base || undefined;
}
