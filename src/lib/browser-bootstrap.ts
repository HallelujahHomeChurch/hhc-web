'use client';

import {createAccountSessionClient, type AccountSession} from '@hallelujahhomechurch/account-client';

export type PushConfig = {vapidPublicKey: string};

const rawAccountClient = createAccountSessionClient({fetcher: (input, init) => fetch(input, init)});
let sessionRequest: Promise<AccountSession> | undefined;
let pushConfigRequest: Promise<PushConfig> | undefined;

const sharedAccountClient = {
  ...rawAccountClient,
  getSession() {
    return sessionRequest ??= rawAccountClient.getSession().catch((error) => {
      sessionRequest = undefined;
      throw error;
    });
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
}

export function resetBrowserBootstrap() {
  sessionRequest = undefined;
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
