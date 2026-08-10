import { describe, expect, it } from 'vitest'

import { sanitizeSentryEvent } from './observability'

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
})
