export function publicContentBaseUrl() {
  return process.env.HHC_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? 'http://127.0.0.1:8081/api';
}

export function historyPrivateContentBaseUrl() {
  const base = process.env.HHC_WEB_HISTORY_API_BASE_URL;
  if (base && !/^https:\/\/hhc-web-api\.internal\.[a-z0-9-]+\.[a-z0-9-]+\.azurecontainerapps\.io\/api$/.test(base)) {
    throw new Error('HHC_WEB_HISTORY_API_BASE_URL must be the internal CMS HTTPS API base');
  }
  return base || undefined;
}
