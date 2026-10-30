export function publicContentBaseUrl() {
  return process.env.HHC_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? 'http://127.0.0.1:8081/api';
}
