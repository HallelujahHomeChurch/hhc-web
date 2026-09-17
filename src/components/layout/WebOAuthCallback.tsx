'use client';

import {createAccountSessionClient, createBrowserAccountAuthRuntime, readOAuthTransaction, type BrowserAccountAuthRuntime} from '@hallelujahhomechurch/account-client';
import {useEffect, useMemo, useState} from 'react';
import {isLocale, type Locale} from '@/i18n/locales';
import {webOAuthConfigForBrowser} from './AccountControl';
import {captureHandledError} from '@/lib/observability';
import {accountApiBaseUrlForBrowser} from '@/lib/account-origin';

type CallbackLabels = {completing: string; error: string};
type WebOAuthCallbackProps = {
  currentUrl?: URL;
  labels?: CallbackLabels;
  navigate?: (url: string) => void;
  runtime?: Pick<BrowserAccountAuthRuntime, 'completeSignIn'>;
};

export function WebOAuthCallback({currentUrl, labels: labelsProp, navigate = defaultNavigate, runtime: providedRuntime}: WebOAuthCallbackProps) {
  const sessionClient = useMemo(() => createAccountSessionClient({baseUrl: accountApiBaseUrlForBrowser()}), []);
  const runtime = useMemo(() => providedRuntime ?? createBrowserAccountAuthRuntime({
    client: sessionClient,
    oauth: webOAuthConfigForBrowser()
  }), [providedRuntime, sessionClient]);
  const returnTo = typeof window === 'undefined'
    ? '/'
    : readOAuthTransaction({storage: sessionStorage, storageKey: 'hhc:oauth:www-web'})?.returnTo ?? '/';
  const labels = labelsProp ?? callbackLabels(returnTo);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const url = currentUrl ?? new URL(window.location.href);
    void runtime.completeSignIn(url.toString())
      .then((result) => {
        if (active && result.status === 'authenticated') navigate(returnTo);
        else if (active) setError(true);
      })
      .catch((cause) => {
        captureHandledError(cause, {operation: 'oauth.callback'});
        if (active) setError(true);
      });
    return () => { active = false; };
  }, [currentUrl, navigate, returnTo, runtime]);

  return (
    <main lang={callbackLocale(returnTo)} className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      {error ? <p role="alert">{labels.error}</p> : <p>{labels.completing}</p>}
    </main>
  );
}

function callbackLabels(returnTo = '/'): CallbackLabels {
  switch (callbackLocale(returnTo)) {
    case 'zh-Hant': return {completing: '正在完成登入…', error: '無法完成登入。'};
    case 'zh-Hans': return {completing: '正在完成登录…', error: '无法完成登录。'};
    case 'ja': return {completing: 'ログインを完了しています…', error: 'ログインを完了できませんでした。'};
    case 'ko': return {completing: '로그인을 완료하는 중입니다…', error: '로그인을 완료할 수 없습니다.'};
    default: return {completing: 'Completing sign in…', error: 'Unable to complete sign in.'};
  }
}

function callbackLocale(returnTo = '/'): Locale {
  const candidate = returnTo.match(/^\/([^/?#]+)(?:[/?#]|$)/)?.[1];
  return candidate && isLocale(candidate) ? candidate : 'en';
}

function defaultNavigate(url: string) {
  window.location.replace(url);
}
