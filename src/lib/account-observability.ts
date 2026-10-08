import * as Sentry from '@sentry/nextjs'
import type {AccountAuthEvent} from '@hallelujahhomechurch/account-client'

const requestId = /^[A-Za-z0-9._:-]{1,128}$/
const reportedAccountErrors = new WeakSet<object>()

export function captureAccountFailure(error: unknown, operation = 'account.session') {
  if (error && typeof error === 'object') {
    if (reportedAccountErrors.has(error)) return
    reportedAccountErrors.add(error)
  }
  const value = (error && typeof error === 'object' ? error : {}) as {status?: unknown; code?: unknown; requestId?: unknown; endpoint?: unknown; method?: unknown; decodeStage?: unknown; name?: unknown}
  const endpoint = typeof value.endpoint === 'string' && ['csrf', 'access_token', 'refresh', 'session', 'logout', 'logout_all', 'oauth_token', 'unknown'].includes(value.endpoint) ? value.endpoint : 'unknown'
  const stage = typeof value.decodeStage === 'string' && ['content_type', 'json', 'schema'].includes(value.decodeStage) ? value.decodeStage : undefined
  const kind = stage || value.code === 'INVALID_RESPONSE' || value.code === 'CSRF_TOKEN_REQUIRED' ? 'invalid_response' : typeof value.status === 'number' ? 'http' : 'network'
  return Sentry.captureException(new Error(`Account API request failed (${kind})`), {
    tags: {api_failure: kind, operation},
    contexts: {api: {
      endpoint,
      method: value.method === 'GET' || value.method === 'POST' ? value.method : 'UNKNOWN',
      ...(stage ? {decode_stage: stage} : {}),
      ...(typeof value.status === 'number' && value.status >= 100 && value.status <= 599 ? {status: value.status} : {}),
      ...(typeof value.code === 'string' && ['INVALID_RESPONSE', 'CSRF_TOKEN_REQUIRED', 'OAUTH_TOKEN_EXCHANGE_FAILED', 'OAUTH_CALLBACK_INVALID', 'OAUTH_CALLBACK_MISMATCH'].includes(value.code) ? {code: value.code} : {}),
      ...(typeof value.requestId === 'string' && requestId.test(value.requestId) ? {request_id: value.requestId} : {}),
      ...(kind === 'network' ? {error_name: typeof value.name === 'string' && ['Error', 'TypeError', 'SyntaxError', 'TimeoutError', 'NetworkError', 'SecurityError'].includes(value.name) ? value.name : 'Error', online: navigator.onLine, visibility: document.visibilityState} : {}),
    }},
    fingerprint: ['account-api-failure', operation, endpoint, kind],
  })
}

export function recordAccountAuthEvent(event: AccountAuthEvent) {
  if (event.outcome === 'failed' && event.status !== undefined && event.status >= 200 && event.status < 300 && ['INVALID_RESPONSE', 'CSRF_TOKEN_REQUIRED'].includes(event.errorCode ?? '')) {
    captureAccountFailure({...event, code: event.errorCode}, `account.session.${event.stage}`)
  }
}

export function observeAccountFetch(fetcher: typeof fetch): typeof fetch {
  return async (input, init) => {
    try {
      const response = await fetcher(input, init)
      if (response.status >= 500) captureAccountFailure({status: response.status, requestId: response.headers.get('x-hhc-request-id') ?? response.headers.get('x-request-id'), method: init?.method ?? 'GET'})
      return response
    } catch (error) {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
      if (!signal?.aborted && !(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')) captureAccountFailure(error)
      throw error
    }
  }
}
