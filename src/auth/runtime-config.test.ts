import { describe, expect, it } from 'vitest'

import { readRuntimeConfig } from './runtime-config'

describe('readRuntimeConfig', () => {
  it('uses account origin for authorization by default on production admin host', () => {
    const config = readRuntimeConfig(
      {},
      new URL('https://admin.alive.org.tw/users'),
    )

    expect(config.accountApiBaseUrl).toBe('/api/account/v1')
    expect(config.accountAuthorizeBaseUrl).toBe('https://account.alive.org.tw/api/account/v1')
    expect(config.redirectUri).toBe('https://admin.alive.org.tw/oauth/callback')
    expect(config.adminClientId).toBe('admin-web')
  })

  it('can run fully mocked for local UI testing', () => {
    const config = readRuntimeConfig(
      {
        VITE_ACCOUNT_API_MOCK: 'true',
        VITE_ACCOUNT_API_BASE_URL: 'http://localhost:8080/api/account/v1',
      },
      new URL('http://localhost:5175/'),
    )

    expect(config.mockApi).toBe(true)
    expect(config.accountApiBaseUrl).toBe('http://localhost:8080/api/account/v1')
    expect(config.redirectUri).toBe('http://localhost:5175/oauth/callback')
  })
})
