import { describe, expect, it } from 'vitest'

import { buildAuthorizeUrl, createCodeChallenge, createOAuthTransaction } from './pkce'
import type { RuntimeConfig } from './runtime-config'

const config: RuntimeConfig = {
  accountApiBaseUrl: 'https://admin.alive.org.tw/api/account/v1',
  accountAuthorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
  adminClientId: 'admin-web',
  redirectUri: 'https://admin.alive.org.tw/oauth/callback',
  oauthScope: 'openid profile email',
  mockApi: false,
  publicSiteUrl: 'https://www.alive.org.tw',
}

describe('PKCE helpers', () => {
  it('creates an S256 code challenge without base64 padding', async () => {
    const challenge = await createCodeChallenge('test-verifier')

    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge).not.toContain('=')
  })

  it('builds an account-host authorize URL and stores local callback state', async () => {
    const transaction = await createOAuthTransaction('/users', {
      randomBytes: () => new Uint8Array(32).fill(7),
      now: () => 123,
    })

    const url = buildAuthorizeUrl(config, transaction)

    expect(url.origin).toBe('https://account.alive.org.tw')
    expect(url.pathname).toBe('/api/account/v1/oauth/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('admin-web')
    expect(url.searchParams.get('redirect_uri')).toBe('https://admin.alive.org.tw/oauth/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe(transaction.state)
    expect(transaction.returnTo).toBe('/users')
  })
})
