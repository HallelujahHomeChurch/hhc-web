import {
  buildAuthorizeUrl as buildSharedAuthorizeUrl,
  clearOAuthTransaction as clearSharedOAuthTransaction,
  createCodeChallenge,
  createOAuthTransaction,
  readOAuthTransaction as readSharedOAuthTransaction,
  saveOAuthTransaction as saveSharedOAuthTransaction,
  validateOAuthState,
  type OAuthTransaction,
  type OAuthTransactionOptions,
} from '@hhc/account-client'

import type { RuntimeConfig } from './runtime-config'

const transactionKey = 'hhc_admin_oauth_transaction'

export type { OAuthTransaction }
export { createCodeChallenge, createOAuthTransaction, validateOAuthState }
export type { OAuthTransactionOptions }

export function buildAuthorizeUrl(
  config: RuntimeConfig,
  transaction: OAuthTransaction,
  options: { prompt?: 'none' } = {},
) {
  return buildSharedAuthorizeUrl({
    authorizeBaseUrl: config.accountAuthorizeBaseUrl,
    clientId: config.adminClientId,
    redirectUri: config.redirectUri,
    scope: config.oauthScope,
  }, transaction, options)
}

export function saveOAuthTransaction(transaction: OAuthTransaction, storage = sessionStorage) {
  saveSharedOAuthTransaction(transaction, { storage, storageKey: transactionKey })
}

export function readOAuthTransaction(storage = sessionStorage): OAuthTransaction | null {
  return readSharedOAuthTransaction({ storage, storageKey: transactionKey })
}

export function clearOAuthTransaction(storage = sessionStorage) {
  clearSharedOAuthTransaction({ storage, storageKey: transactionKey })
}
