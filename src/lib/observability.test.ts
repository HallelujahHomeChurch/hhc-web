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
