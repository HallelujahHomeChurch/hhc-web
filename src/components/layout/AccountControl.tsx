'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {UserRound} from 'lucide-react';
import {
  buildAuthorizeUrl,
  createAccountSessionClient,
  createOAuthTransactionOnce,
  currentReturnTo,
  resolveAccountAuth,
  type AccountSessionUser,
  type AccountSessionClient,
  type OAuthClientConfig
} from '@hallelujahhomechurch/account-client';
import {AccountMenu, Toast} from '@hallelujahhomechurch/ui';

export const webOAuthTransactionKey = 'hhc_web_oauth_transaction';
export const webPassiveSsoAttemptKey = 'hhc_web_passive_sso_attempted';
export const accountStateEventName = 'hhc:account-state';

type AccountControlState =
  | {status: 'loading'}
  | {status: 'anonymous'}
  | {status: 'unavailable'}
  | {status: 'authenticated'; user: AccountSessionUser};

interface AccountControlLabels {
  menu: string;
  manageAccount: string;
  signIn: string;
  signOut: string;
  signOutError: string;
}

interface AccountControlProps {
  accountSiteUrl?: string;
  client?: AccountSessionClient;
  labels: AccountControlLabels;
  navigateExternal?: (url: string) => void;
  oauth?: OAuthClientConfig;
}

export function AccountControl({
  accountSiteUrl = accountSiteUrlForBrowser(),
  client,
  labels,
  navigateExternal = defaultNavigateExternal,
  oauth
}: AccountControlProps) {
  const sessionClient = useMemo(() => client ?? createAccountSessionClient(), [client]);
  const oauthConfig = useMemo(() => oauth ?? webOAuthConfigForBrowser(), [oauth]);
  const [auth, setAuth] = useState<AccountControlState>({status: 'loading'});
  const [logoutError, setLogoutError] = useState('');
  const requestRevision = useRef(0);
  const authorizationStarted = useRef(false);

  const refreshSession = useCallback(async () => {
    const revision = ++requestRevision.current;
    const result = await resolveAccountAuth(sessionClient);
    if (revision !== requestRevision.current) return result;

    if (result.status === 'authenticated') {
      sessionStorage.removeItem(webPassiveSsoAttemptKey);
    }
    setAuth((current) => {
      if (result.status === 'authenticated') return {status: 'authenticated', user: result.user};
      if (result.status === 'anonymous') return {status: 'anonymous'};
      return current.status === 'authenticated' ? current : {status: 'unavailable'};
    });
    return result;
  }, [sessionClient]);

  const beginAuthorization = useCallback((prompt?: 'none') => {
    if (authorizationStarted.current) return;
    authorizationStarted.current = true;
    void createOAuthTransactionOnce(currentReturnTo(window.location), {
      storage: sessionStorage,
      storageKey: webOAuthTransactionKey
    })
      .then((transaction) => {
        navigateExternal(buildAuthorizeUrl(oauthConfig, transaction, {prompt}).toString());
      })
      .catch(() => {
        authorizationStarted.current = false;
        setAuth({status: 'unavailable'});
      });
  }, [navigateExternal, oauthConfig]);

  useEffect(() => {
    let active = true;
    void refreshSession()
      .then((result) => {
        if (!active) return;
        if (result.status !== 'anonymous' || !shouldAttemptPassiveSso()) return;
        sessionStorage.setItem(webPassiveSsoAttemptKey, '1');
        beginAuthorization('none');
      });
    return () => { active = false; };
  }, [beginAuthorization, refreshSession]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refreshSession(), 100);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    const onAccountState = () => scheduleRefresh();
    const channel = typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(accountStateEventName);

    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('pageshow', scheduleRefresh);
    window.addEventListener(accountStateEventName, onAccountState);
    document.addEventListener('visibilitychange', onVisibilityChange);
    channel?.addEventListener('message', onAccountState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', scheduleRefresh);
      window.removeEventListener('pageshow', scheduleRefresh);
      window.removeEventListener(accountStateEventName, onAccountState);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      channel?.close();
    };
  }, [refreshSession]);

  if (auth.status === 'loading' || auth.status === 'unavailable') {
    return <span className="inline-block size-10 shrink-0" aria-hidden="true" />;
  }

  if (auth.status === 'anonymous') {
    return (
      <a
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={`${accountSiteUrl}/login`}
        aria-label={labels.signIn}
        onClick={(event) => {
          event.preventDefault();
          beginAuthorization();
        }}
      >
        <UserRound size={21} aria-hidden="true" />
      </a>
    );
  }

  const user = auth.user;
  const displayName = user.display_name || user.email.split('@')[0] || user.email;

  return (
    <>
      <AccountMenu
        labels={{
          menu: labels.menu,
          greeting: `Hi ${displayName}`,
          manageAccount: labels.manageAccount,
          signOut: labels.signOut
        }}
        manageAccountHref={`${accountSiteUrl}/profile`}
        onSignOut={() => {
          setLogoutError('');
          void sessionClient.logoutAll()
            .then(() => {
              setAuth({status: 'anonymous'});
              notifyAccountStateChange('sign-out');
            })
            .catch(async () => {
              const result = await refreshSession();
              if (result.status === 'anonymous') {
                notifyAccountStateChange('sign-out');
                return;
              }
              setLogoutError(labels.signOutError);
            });
        }}
        user={{
          name: displayName,
          email: user.email,
          avatarUrl: user.avatar_url
        }}
      />
      {logoutError ? (
        <div className="fixed right-6 top-20 z-50 max-w-[min(360px,calc(100vw-32px))]">
          <Toast tone="danger">{logoutError}</Toast>
        </div>
      ) : null}
    </>
  );
}

export function notifyAccountStateChange(type: 'profile-changed' | 'sign-out') {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(accountStateEventName);
  channel.postMessage({type});
  channel.close();
}

function shouldAttemptPassiveSso() {
  const hasHint = document.cookie
    .split(';')
    .some((cookie) => cookie.trim() === 'hhc_sso_hint=1');
  return hasHint && sessionStorage.getItem(webPassiveSsoAttemptKey) !== '1';
}

function defaultNavigateExternal(url: string) {
  window.location.assign(url);
}

export function webOAuthConfigForBrowser(): OAuthClientConfig {
  const origin = typeof window === 'undefined' ? 'https://www.alive.org.tw' : window.location.origin;
  return {
    authorizeBaseUrl: accountAuthorizeBaseUrlForBrowser(),
    clientId: 'www-web',
    redirectUri: `${origin}/oauth/callback`,
    scope: 'openid profile email'
  };
}

function accountAuthorizeBaseUrlForBrowser() {
  const configured = process.env.NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  return `${accountSiteUrlForBrowser()}/api/account/v1`;
}

function accountSiteUrlForBrowser() {
  const configured = process.env.NEXT_PUBLIC_ACCOUNT_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window === 'undefined') return 'https://account.alive.org.tw';
  if (window.location.hostname === 'www-test.alive.org.tw') return 'https://account-test.alive.org.tw';
  if (window.location.hostname === 'www.alive.org.tw') return 'https://account.alive.org.tw';
  return 'http://localhost:5173';
}
