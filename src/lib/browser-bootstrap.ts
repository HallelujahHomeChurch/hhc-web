'use client';

import {AccountSessionError, createAccountSessionClient, type AccountAccessToken, type AccountSession} from '@hallelujahhomechurch/account-client';
import {accountApiBaseUrlForBrowser} from './account-origin';

export type PushConfig = {vapidPublicKey: string};

let accessTokenRetryAfterAt = 0;
const rawAccountClient = createAccountSessionClient({
  baseUrl: accountApiBaseUrlForBrowser(),
  fetcher: async (input, init) => {
    const response = await fetch(input, init);
    if (String(input).endsWith('/session/access-token') && response.status === 429) {
      accessTokenRetryAfterAt = parseRetryAfter(response.headers.get('Retry-After'));
    }
    return response;
  }
});
let sessionRequest: Promise<AccountSession> | undefined;
let accessToken: AccountAccessToken | undefined;
let accessTokenExpiresAt = 0;
let accessTokenRequest: Promise<AccountAccessToken> | undefined;
let pushConfigRequest: Promise<PushConfig> | undefined;

const sharedAccountClient = {
  ...rawAccountClient,
  getSession() {
    return sessionRequest ??= rawAccountClient.getSession().catch((error) => {
      sessionRequest = undefined;
      throw error;
    });
  },
  issueAccessToken() {
    if (accessToken && Date.now() < accessTokenExpiresAt - 30_000) return Promise.resolve(accessToken);
    if (Date.now() < accessTokenRetryAfterAt) return Promise.reject(new AccountSessionError(429, 'RATE_LIMITED'));
    return accessTokenRequest ??= rawAccountClient.issueAccessToken()
      .then((value) => {
        accessToken = value;
        accessTokenExpiresAt = Date.now() + value.expiresIn * 1000;
        accessTokenRetryAfterAt = 0;
        return value;
      })
      .finally(() => {accessTokenRequest = undefined;});
  }
};

export function getSharedAccountSessionClient() {
  return sharedAccountClient;
}

export function revalidateSharedAccountSession() {
  sessionRequest = rawAccountClient.getSession().catch((error) => {
    sessionRequest = undefined;
    throw error;
  });
  return sessionRequest;
}

export function clearSharedAccountSession() {
  sessionRequest = undefined;
  accessToken = undefined;
  accessTokenExpiresAt = 0;
  accessTokenRetryAfterAt = 0;
  accessTokenRequest = undefined;
}

export function resetBrowserBootstrap() {
  clearSharedAccountSession();
  pushConfigRequest = undefined;
}

export function getSharedPushConfig() {
  return pushConfigRequest ??= fetch('/api/engagement/v1/push/config', {headers: {Accept: 'application/json'}})
    .then(async (response) => {
      if (!response.ok) throw new Error('push config unavailable');
      const payload = await response.json() as {data?: Partial<PushConfig>};
      if (!payload.data?.vapidPublicKey) throw new Error('push config invalid');
      return {vapidPublicKey: payload.data.vapidPublicKey};
    })
    .catch((error) => {
      pushConfigRequest = undefined;
      throw error;
    });
}

function parseRetryAfter(value: string | null) {
  const seconds = Number(value);
  if (value?.trim() && Number.isFinite(seconds)) return Date.now() + Math.max(0, seconds * 1000);
  const date = Date.parse(value ?? '');
  return Number.isFinite(date) ? Math.max(Date.now(), date) : Date.now() + 60_000;
}
