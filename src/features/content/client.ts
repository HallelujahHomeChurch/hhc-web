import {createHhcWebClient} from '@hallelujahhomechurch/hhc-web-client';

// Match the API response write limit (30s) plus 5s transport/body margin.
// WriteTimeout is not a handler or SQL deadline; this bounds the SSR resolution.
const contentTimeoutMs = 35_000;

function contentFetch(fresh: boolean): typeof fetch {
  // One resolution may try a legacy projection; it shares the original budget.
  let deadline: AbortSignal | undefined;
  return async (input, init) => {
    deadline ??= AbortSignal.timeout(contentTimeoutMs);
    const signals = [deadline];
    if (input instanceof Request) signals.push(input.signal);
    if (init?.signal) signals.push(init.signal);
    const signal = AbortSignal.any(signals);
    signal.throwIfAborted();
    // Keep the deadline alive after headers: SDK JSON/body reads must also abort.
    return fetch(input, {
      ...init,
      signal,
      ...(fresh ? {cache: 'no-store'} : {next: {revalidate: 60}})
    } as RequestInit & {next?: {revalidate: number}});
  };
}

export function publicContentClient(fresh = false) {
  return createHhcWebClient({
    baseUrl: process.env.HHC_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? 'http://127.0.0.1:8081/api',
    getAccessToken: () => null,
    fetcher: contentFetch(fresh)
  });
}
