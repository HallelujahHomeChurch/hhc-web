import { afterEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(() => 'event-id'),
  scope: {
    setLevel: vi.fn(),
    setTag: vi.fn(),
  },
  withScope: vi.fn((callback: (scope: {setLevel: typeof sentry.scope.setLevel; setTag: typeof sentry.scope.setTag}) => void) => callback(sentry.scope)),
}))

vi.mock('@sentry/nextjs', () => sentry)

import { captureHandledError, sanitizeSentryEvent } from './observability'
import {captureAccountFailure, observeAccountFetch, recordAccountAuthEvent} from './account-observability'

afterEach(() => vi.clearAllMocks())

describe('observability privacy boundary', () => {
  it('removes user data and sensitive URL values before sending', () => {
    const event = sanitizeSentryEvent({
      request: {
        url: 'https://www.alive.org.tw/zh-Hant?token=secret#section',
        headers: { cookie: 'refresh=secret' },
      },
      user: { email: 'member@example.com' },
      message: 'Failed for member@example.com with sig=secret',
    })

    expect(event.request).toEqual({ url: 'https://www.alive.org.tw/zh-Hant' })
    expect(event.user).toBeUndefined()
    expect(event.message).toBe('Failed for [redacted-email] with sig=[redacted]')
    expect(JSON.stringify(event)).not.toContain('secret')
    expect(JSON.stringify(event)).not.toContain('member@example.com')
  })

  it('captures handled failures with bounded scalar context', () => {
    const error = new Error('Weekly request failed')

    expect(captureHandledError(error, {
      operation: 'weekly.archive',
      level: 'warning',
      tags: {status: 503, memberMode: true, omitted: undefined},
    })).toBe('event-id')

    expect(sentry.scope.setLevel).toHaveBeenCalledWith('warning')
    expect(sentry.scope.setTag).toHaveBeenCalledWith('operation', 'weekly.archive')
    expect(sentry.scope.setTag).toHaveBeenCalledWith('status', '503')
    expect(sentry.scope.setTag).toHaveBeenCalledWith('memberMode', 'true')
    expect(sentry.scope.setTag).not.toHaveBeenCalledWith('omitted', expect.anything())
    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })
})

it('strips automatic request and form data from caught Account API failures', () => {
  const event = sanitizeSentryEvent({tags: {api_failure: 'invalid_response', operation: 'account.session'}, request: {url: 'https://www.alive.org.tw/callback?code=private'}, breadcrumbs: [{data: {email: 'private@example.test'}}], extra: {body: 'private-body'}, contexts: {api: {endpoint: 'csrf', decode_stage: 'json', request_id: 'safe-id'}}})
  expect(event.request).toBeUndefined()
  expect(event.breadcrumbs).toBeUndefined()
  expect(event.extra).toBeUndefined()
  expect(JSON.stringify(event)).not.toContain('private')
  expect(event.contexts).toEqual({api: {endpoint: 'csrf', decode_stage: 'json', request_id: 'safe-id'}})
})


it('reports safe decode context without the original payload and deduplicates an error', () => {
  const error = Object.assign(new Error('secret response private@example.test'), {status: 200, code: 'INVALID_RESPONSE', endpoint: 'csrf', method: 'GET', decodeStage: 'json', requestId: 'safe-id'})
  captureAccountFailure(error)
  captureAccountFailure(error)
  expect(sentry.captureException).toHaveBeenCalledOnce()
  const [captured, context] = sentry.captureException.mock.calls[0] as unknown as [Error, {contexts: {api: Record<string, unknown>}}]
  expect(captured).not.toBe(error)
  expect(context.contexts.api).toMatchObject({endpoint: 'csrf', method: 'GET', decode_stage: 'json', request_id: 'safe-id', status: 200})
  expect(JSON.stringify(context) + captured.message).not.toContain('private')
})

it('preserves network rejection and records only safe browser metadata once', async () => {
  const error = new TypeError('private@example.test token=secret')
  const fetcher = observeAccountFetch(async () => { throw error })
  await expect(fetcher('/api/account/v1/session?token=secret')).rejects.toBe(error)
  await expect(fetcher('/api/account/v1/session?token=secret')).rejects.toBe(error)
  expect(sentry.captureException).toHaveBeenCalledOnce()
  expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({contexts: {api: expect.objectContaining({error_name: 'TypeError', online: navigator.onLine, visibility: document.visibilityState})}}))
  expect(JSON.stringify(sentry.captureException.mock.calls)).not.toContain('secret')
})

it('keeps expected rejection and aborts out of Account API reporting', async () => {
  const response = new Response(null, {status: 403})
  await expect(observeAccountFetch(async () => response)('/api/account/v1/session')).resolves.toBe(response)
  await expect(observeAccountFetch(async () => {throw new DOMException('cancel', 'AbortError')})('/api/account/v1/session')).rejects.toBeDefined()
  recordAccountAuthEvent({stage: 'refresh', outcome: 'rejected', status: 403})
  expect(sentry.captureException).not.toHaveBeenCalled()
})

it('correlates server failure and rejects unsafe metadata', async () => {
  const response = new Response(null, {status: 503, headers: {'x-hhc-request-id': 'safe-id'}})
  await expect(observeAccountFetch(async () => response)('/api/account/v1/session')).resolves.toBe(response)
  expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({contexts: {api: expect.objectContaining({status: 503, request_id: 'safe-id', method: 'GET'})}}))
  captureAccountFailure({status: 200, code: 'token=secret', endpoint: '/private?token=secret', requestId: 'email@example.test', decodeStage: 'secret', name: 'token=secret'})
  expect(JSON.stringify(sentry.captureException.mock.calls)).not.toContain('secret')
})
