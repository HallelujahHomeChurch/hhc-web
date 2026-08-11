'use client';

import {
  buildAuthorizeUrl,
  claimOAuthRecovery,
  clearOAuthTransaction,
  readOAuthTransaction,
  validateOAuthState,
  type OAuthClientConfig
} from '@hallelujahhomechurch/account-client';
import {Button} from '@hallelujahhomechurch/ui';
import {useEffect, useRef, useState} from 'react';
import {isLocale, type Locale} from '@/i18n/locales';
import {webOAuthConfigForBrowser, webOAuthTransactionKey} from './AccountControl';

type CallbackLabels = {
  completing: string;
  error: string;
  retry: string;
};

type WebOAuthCallbackProps = {
  currentUrl?: URL;
  fetcher?: typeof fetch;
  labels?: CallbackLabels;
  navigate?: (url: string) => void;
  oauth?: OAuthClientConfig;
  storage?: Storage;
};

export function WebOAuthCallback({
  currentUrl,
  fetcher = fetch,
  labels: labelsProp,
  navigate = defaultNavigate,
  oauth,
  storage
}: WebOAuthCallbackProps) {
  const [error, setError] = useState<{message: string; retryable: boolean} | null>(null);
  const [attempt, setAttempt] = useState(0);
  const completion = useRef<{attempt: number; promise: Promise<void>} | null>(null);

  useEffect(() => {
    let active = true;
    const url = currentUrl ?? new URL(window.location.href);
    const transactionStorage = storage ?? sessionStorage;
    const transaction = readOAuthTransaction({
      storage: transactionStorage,
      storageKey: webOAuthTransactionKey
    });
    const labels = labelsProp ?? callbackLabels(transaction?.returnTo);
    const reportError = (retryable = false) => queueMicrotask(() => {
      if (active) setError({message: labels.error, retryable});
    });
    const state = url.searchParams.get('state') ?? '';

    if (!validateOAuthState(transaction, state)) {
      if (transaction && claimOAuthRecovery({
        storage: transactionStorage,
        storageKey: webOAuthTransactionKey
      })) {
        navigate(buildAuthorizeUrl(oauth ?? webOAuthConfigForBrowser(), transaction).toString());
        return () => { active = false; };
      }
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

    if (!completion.current || completion.current.attempt !== attempt) {
      completion.current = {
        attempt,
        promise: completeSignIn({attempt, code, fetcher, transaction, url})
      };
    }
    completion.current.promise
      .then(() => {
        clearOAuthTransaction({storage: transactionStorage, storageKey: webOAuthTransactionKey});
        if (active) navigate(transaction.returnTo);
      })
      .catch(() => reportError(true));

    return () => { active = false; };
  }, [attempt, currentUrl, fetcher, labelsProp, navigate, oauth, storage]);

  const labelStorage = storage ?? (typeof window === 'undefined' ? null : sessionStorage);
  const returnTo = labelStorage
    ? readOAuthTransaction({storage: labelStorage, storageKey: webOAuthTransactionKey})?.returnTo
    : undefined;
  const labels = labelsProp ?? callbackLabels(returnTo);

  return (
    <main lang={callbackLocale(returnTo)} className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      {error ? (
        <div className="grid justify-items-center gap-4 text-center">
          <p role="alert">{error.message}</p>
          {error.retryable ? (
            <Button variant="outline" onPress={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}>
              {labels.retry}
            </Button>
          ) : null}
        </div>
      ) : <p>{labels.completing}</p>}
    </main>
  );
}

async function completeSignIn({
  attempt,
  code,
  fetcher,
  transaction,
  url
}: {
  attempt: number;
  code: string;
  fetcher: typeof fetch;
  transaction: NonNullable<ReturnType<typeof readOAuthTransaction>>;
  url: URL;
}) {
  if (attempt > 0) {
    const session = await fetcher('/api/account/v1/session', {
      method: 'GET',
      credentials: 'include',
      headers: {accept: 'application/json'},
      cache: 'no-store'
    });
    if (session.ok) {
      try {
        const body: unknown = await session.json();
        if (isAuthenticatedSession(body)) return;
      } catch {
        // Retry the original exchange when session recovery returned an invalid body.
      }
    }
  }

  const response = await fetcher('/api/account/v1/oauth/token', {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/oauth/callback`,
      client_id: 'www-web',
      code_verifier: transaction.codeVerifier
    })
  });
  if (!response.ok) throw new Error('Token exchange failed');
}

function isAuthenticatedSession(value: unknown): value is {authenticated: true} {
  return typeof value === 'object' && value !== null
    && 'authenticated' in value && value.authenticated === true;
}

function callbackLabels(returnTo = '/') : CallbackLabels {
  switch (callbackLocale(returnTo)) {
    case 'zh-Hant': return {completing: '正在完成登入…', error: '無法完成登入。', retry: '再試一次'};
    case 'zh-Hans': return {completing: '正在完成登录…', error: '无法完成登录。', retry: '重试'};
    case 'ja': return {completing: 'ログインを完了しています…', error: 'ログインを完了できませんでした。', retry: 'もう一度試す'};
    case 'ko': return {completing: '로그인을 완료하는 중입니다…', error: '로그인을 완료할 수 없습니다.', retry: '다시 시도'};
    default: return {completing: 'Completing sign in…', error: 'Unable to complete sign in.', retry: 'Try again'};
  }
}

function callbackLocale(returnTo = '/'): Locale {
  const candidate = returnTo.match(/^\/([^/?#]+)(?:[/?#]|$)/)?.[1];
  return candidate && isLocale(candidate) ? candidate : 'en';
}

function defaultNavigate(url: string) {
  window.location.replace(url);
}
