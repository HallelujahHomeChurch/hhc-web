'use client';

import {createAccountSessionClient, type AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {accountApiBaseUrlForBrowser} from './account-origin';

export type PushConfig = {vapidPublicKey: string};

let accountSessionClient: AccountSessionClient | undefined;
let pushConfigRequest: Promise<PushConfig> | undefined;

export function resetBrowserBootstrap() {
  accountSessionClient = undefined;
  pushConfigRequest = undefined;
}

export function getSharedAccountSessionClient() {
  return accountSessionClient ??= createAccountSessionClient({baseUrl: accountApiBaseUrlForBrowser()});
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
