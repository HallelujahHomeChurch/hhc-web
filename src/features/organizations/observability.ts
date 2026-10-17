import {captureHandledError} from '@/lib/observability'

type Context = {operation: string; method: string}
const contexts = new WeakMap<Response, Context>()
export function isAbortError(error: unknown) { return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError' }
export function reportApiFailure(context: Context, kind: string, response?: Response) {
  const id = response?.headers.get('X-HHC-Request-ID')
  try { captureHandledError(new Error(`Management API request failed (${kind})`), {operation: context.operation, tags: {api_failure: kind, method: context.method, status: response?.status, ...(id && /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? {request_id: id} : {})}}) } catch { /* Reporting must never alter delivery or retries. */ }
}
export function reportResponseFailure(response: Response, kind: string) {
  const context = contexts.get(response)
  if (context) reportApiFailure(context, kind, response)
}
export function observeApiFetch(fetcher: typeof fetch, operation: string): typeof fetch {
  return async (input, init) => {
    const context = {operation, method: init?.method ?? (input instanceof Request ? input.method : 'GET')}
    let response: Response
    try { response = await fetcher(input, init) }
    catch (error) {
      if (!(init?.signal ?? (input instanceof Request ? input.signal : undefined))?.aborted && !isAbortError(error)) reportApiFailure(context, 'network')
      throw error
    }
    contexts.set(response, context)
    if (response.status >= 500) reportApiFailure(context, 'http', response)
    return response
  }
}
