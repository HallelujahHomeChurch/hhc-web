import {createHhcWebClient} from '@hallelujahhomechurch/hhc-web-client';

const cachedFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  next: {revalidate: 60}
} as RequestInit & {next: {revalidate: number}});

export function publicContentClient(fresh = false) {
  return createHhcWebClient({
    baseUrl: process.env.HHC_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? 'http://127.0.0.1:8081/api',
    getAccessToken: () => null,
    fetcher: fresh ? (input, init) => fetch(input, {...init, cache: 'no-store'}) : cachedFetch
  });
}
