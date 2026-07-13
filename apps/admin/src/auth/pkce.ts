import type { RuntimeConfig } from './runtime-config'

export type OAuthTransaction = {
  state: string
  codeVerifier: string
  codeChallenge: string
  returnTo: string
  createdAt: number
}

type TransactionOptions = {
  randomBytes?: () => Uint8Array
  now?: () => number
}

const transactionKey = 'hhc_admin_oauth_transaction'

export async function createOAuthTransaction(
  returnTo: string,
  options: TransactionOptions = {},
): Promise<OAuthTransaction> {
  const codeVerifier = base64UrlEncode((options.randomBytes ?? randomBytes)(32))
  const state = base64UrlEncode((options.randomBytes ?? randomBytes)(24))

  return {
    state,
    codeVerifier,
    codeChallenge: await createCodeChallenge(codeVerifier),
    returnTo: safeReturnTo(returnTo),
    createdAt: options.now?.() ?? Date.now(),
  }
}

export async function createCodeChallenge(codeVerifier: string) {
  const bytes = new TextEncoder().encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return base64UrlEncode(new Uint8Array(digest))
}

export function buildAuthorizeUrl(config: RuntimeConfig, transaction: OAuthTransaction) {
  const url = new URL(`${config.accountAuthorizeBaseUrl.replace(/\/$/, '')}/oauth/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.adminClientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', config.oauthScope)
  url.searchParams.set('state', transaction.state)
  url.searchParams.set('code_challenge', transaction.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}

export function saveOAuthTransaction(transaction: OAuthTransaction, storage = sessionStorage) {
  storage.setItem(transactionKey, JSON.stringify(transaction))
}

export function readOAuthTransaction(storage = sessionStorage): OAuthTransaction | null {
  const raw = storage.getItem(transactionKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as OAuthTransaction
    if (!parsed.state || !parsed.codeVerifier) return null
    return parsed
  } catch {
    return null
  }
}

export function clearOAuthTransaction(storage = sessionStorage) {
  storage.removeItem(transactionKey)
}

export function base64UrlEncode(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function randomBytes(size: number) {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes
}

function safeReturnTo(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
