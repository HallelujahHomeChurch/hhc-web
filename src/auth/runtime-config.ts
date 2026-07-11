export type RuntimeConfig = {
  accountApiBaseUrl: string
  accountAuthorizeBaseUrl: string
  adminClientId: string
  redirectUri: string
  oauthScope: string
  mockApi: boolean
  publicSiteUrl: string
}

type EnvLike = Record<string, string | boolean | undefined>

export function readRuntimeConfig(
  env: EnvLike = import.meta.env,
  currentUrl: URL = new URL(window.location.href),
): RuntimeConfig {
  const origin = currentUrl.origin
  const accountApiBaseUrl = stringEnv(env.VITE_ACCOUNT_API_BASE_URL, '/api/account/v1')
  const accountAuthorizeBaseUrl = stringEnv(
    env.VITE_ACCOUNT_AUTHORIZE_BASE_URL,
    defaultAuthorizeBaseUrl(currentUrl, accountApiBaseUrl),
  )

  return {
    accountApiBaseUrl,
    accountAuthorizeBaseUrl,
    adminClientId: stringEnv(env.VITE_ADMIN_CLIENT_ID, 'admin-web'),
    redirectUri: stringEnv(env.VITE_ADMIN_REDIRECT_URI, `${origin}/oauth/callback`),
    oauthScope: stringEnv(env.VITE_ADMIN_OAUTH_SCOPE, 'openid profile email'),
    mockApi: env.VITE_ACCOUNT_API_MOCK === 'true' || env.VITE_ACCOUNT_API_MOCK === true,
    publicSiteUrl: stringEnv(env.VITE_PUBLIC_SITE_URL, 'https://www.alive.org.tw').replace(/\/$/, ''),
  }
}

function stringEnv(value: string | boolean | undefined, fallback: string) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

function defaultAuthorizeBaseUrl(currentUrl: URL, accountApiBaseUrl: string) {
  if (currentUrl.hostname === 'admin.alive.org.tw' || currentUrl.hostname === 'admin-test.alive.org.tw') {
    const host = currentUrl.hostname === 'admin-test.alive.org.tw'
      ? 'https://account-test.alive.org.tw'
      : 'https://account.alive.org.tw'
    return `${host}/api/account/v1`
  }

  return accountApiBaseUrl
}
