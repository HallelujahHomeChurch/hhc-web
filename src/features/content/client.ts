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
    // Next can detach cache revalidation from the caller's signal. Bound our
    // wait independently, including the public JSON body, without disabling ISR.
    return new Promise<Response>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener('abort', abort);
        reject(signal.reason);
      };
      signal.addEventListener('abort', abort, {once: true});
      const read = async () => {
        const response = await fetch(input, {
          ...init,
          signal,
          ...(fresh ? {cache: 'no-store'} : {next: {revalidate: 60}})
        } as RequestInit & {next?: {revalidate: number}});
        const body = response.body === null ? null : await response.arrayBuffer();
        return new Response(body, {
          status: response.status, statusText: response.statusText, headers: response.headers
        });
      };
      void read().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  };
}

export function publicContentClient(fresh = false) {
  return createHhcWebClient({
    baseUrl: process.env.HHC_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? 'http://127.0.0.1:8081/api',
    getAccessToken: () => null,
    fetcher: contentFetch(fresh)
  });
}
