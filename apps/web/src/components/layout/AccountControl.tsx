'use client';

import {useEffect, useMemo, useState, type MouseEvent} from 'react';
import {UserRound} from 'lucide-react';
import {
  buildAuthorizeUrl,
  createAccountSessionClient,
  createOAuthTransaction,
  currentReturnTo,
  saveOAuthTransaction,
  type AccountSession,
  type AccountSessionClient,
  type OAuthClientConfig
} from '@hhc/account-client';
import {AccountMenu, Toast} from '@hhc/ui';

export const webOAuthTransactionKey = 'hhc_web_oauth_transaction';
export const webPassiveSsoAttemptKey = 'hhc_web_passive_sso_attempted';

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
  const [session, setSession] = useState<AccountSession | null>(null);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    let active = true;
    sessionClient.getSession()
      .then(async (nextSession) => {
        if (!active) return;
        if (nextSession.authenticated || !shouldAttemptPassiveSso()) {
          setSession(nextSession);
          return;
        }

        sessionStorage.setItem(webPassiveSsoAttemptKey, '1');
        const transaction = await createWebOAuthTransaction();
        if (!active) return;
        navigateExternal(buildAuthorizeUrl(oauthConfig, transaction, {prompt: 'none'}).toString());
      })
      .catch(() => { if (active) setSession({authenticated: false}); });
    return () => { active = false; };
  }, [navigateExternal, oauthConfig, sessionClient]);

  if (session === null) {
    return <span className="inline-block size-10 shrink-0" aria-hidden="true" />;
  }

  if (!session.authenticated) {
    return (
      <a
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={`${accountSiteUrl}/login`}
        aria-label={labels.signIn}
        onClick={(event) => beginInteractiveSignIn(event, oauthConfig, navigateExternal)}
      >
        <UserRound size={21} aria-hidden="true" />
      </a>
    );
  }

  const user = session.user;
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
            .then(() => setSession({authenticated: false}))
            .catch(() => setLogoutError(labels.signOutError));
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

function beginInteractiveSignIn(
  event: MouseEvent<HTMLAnchorElement>,
  oauth: OAuthClientConfig,
  navigateExternal: (url: string) => void
) {
  event.preventDefault();
  void createWebOAuthTransaction()
    .then((transaction) => navigateExternal(buildAuthorizeUrl(oauth, transaction).toString()));
}

async function createWebOAuthTransaction() {
  const transaction = await createOAuthTransaction(currentReturnTo(window.location));
  saveOAuthTransaction(transaction, {
    storage: sessionStorage,
    storageKey: webOAuthTransactionKey
  });
  return transaction;
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

function webOAuthConfigForBrowser(): OAuthClientConfig {
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
