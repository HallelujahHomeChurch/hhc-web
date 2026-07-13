'use client';

import {
  clearOAuthTransaction,
  readOAuthTransaction,
  validateOAuthState
} from '@hhc/account-client';
import {useEffect, useState} from 'react';
import {webOAuthTransactionKey} from './AccountControl';

type WebOAuthCallbackProps = {
  currentUrl?: URL;
  fetcher?: typeof fetch;
  navigate?: (url: string) => void;
  storage?: Storage;
};

export function WebOAuthCallback({
  currentUrl,
  fetcher = fetch,
  navigate = defaultNavigate,
  storage
}: WebOAuthCallbackProps) {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const reportError = () => queueMicrotask(() => {
      if (active) setError('Unable to complete sign in.');
    });
    const url = currentUrl ?? new URL(window.location.href);
    const transactionStorage = storage ?? sessionStorage;
    const transaction = readOAuthTransaction({
      storage: transactionStorage,
      storageKey: webOAuthTransactionKey
    });
    const state = url.searchParams.get('state') ?? '';

    if (!validateOAuthState(transaction, state)) {
      reportError();
      return () => { active = false; };
    }

    const callbackError = url.searchParams.get('error');
    if (callbackError) {
      clearOAuthTransaction({storage: transactionStorage, storageKey: webOAuthTransactionKey});
      if (callbackError === 'login_required') navigate(transaction.returnTo);
      else reportError();
      return () => { active = false; };
    }

    const code = url.searchParams.get('code');
    if (!code) {
      reportError();
      return () => { active = false; };
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/oauth/callback`,
      client_id: 'www-web',
      code_verifier: transaction.codeVerifier
    });

    fetcher('/api/account/v1/oauth/token', {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    }).then((response) => {
      if (!response.ok) throw new Error('Token exchange failed');
      clearOAuthTransaction({storage: transactionStorage, storageKey: webOAuthTransactionKey});
      if (active) navigate(transaction.returnTo);
    }).catch(() => {
      clearOAuthTransaction({storage: transactionStorage, storageKey: webOAuthTransactionKey});
      if (active) navigate(transaction.returnTo);
    });

    return () => { active = false; };
  }, [currentUrl, fetcher, navigate, storage]);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      {error ? <p role="alert">{error}</p> : <p>Completing sign in...</p>}
    </main>
  );
}

function defaultNavigate(url: string) {
  window.location.replace(url);
}
