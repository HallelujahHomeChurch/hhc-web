'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {
  createBrowserAccountAuthRuntime,
  type AccountAuthState,
  type AccountSessionClient,
  type BrowserOAuthConfig
} from '@hallelujahhomechurch/account-client';
import {canAccessAdmin} from '@hallelujahhomechurch/account-client/admin-access';
import {createOperationsClient} from '@hallelujahhomechurch/operations-client';
import {bulletinEditions, type BulletinEdition} from '@hallelujahhomechurch/preferences';
import {AccountMenu, Toast} from '@hallelujahhomechurch/ui';
import {captureHandledError} from '@/lib/observability';
import {getSharedAccountSessionClient} from '@/lib/browser-bootstrap';
import {accountAuthorizeBaseUrlForBrowser, accountSessionBaseUrlForBrowser, accountSiteUrlForBrowser} from '@/lib/account-origin';
import {siteConfig} from '@/lib/site';

export const accountStateEventName = 'hhc:account-state';
export const webPassiveSsoAttemptKey = 'hhc_web_passive_sso_attempted';

type AccountControlLabels = {
  menu: string;
  projectionSystem: string;
  adminManagement: string;
  manageAccount: string;
  signIn: string;
  signOut: string;
  signOutError: string;
};

type BulletinAccess =
  | {status: 'loading'; editions: readonly BulletinEdition[]}
  | {status: 'available'; editions: readonly BulletinEdition[]}
  | {status: 'unavailable'; editions: readonly BulletinEdition[]};

type AccountControlProps = {
  accountSiteUrl?: string;
  client?: AccountSessionClient;
  labels: AccountControlLabels;
  oauth?: BrowserOAuthConfig;
};

type AccountControlContextValue = {
  accountSiteUrl: string;
  auth: AccountAuthState;
  bulletinAccess: BulletinAccess;
  beginAuthorization: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
  labels: AccountControlLabels;
  signOut: () => Promise<boolean>;
};

const AccountControlContext = createContext<AccountControlContextValue | null>(null);
const noBulletinAccess: BulletinAccess = {status: 'available', editions: []};
const unavailableBulletinAuthorization = {
  getAccessToken: async () => null,
  refreshAfterUnauthorized: async () => null
};
const entitlementByEdition: Readonly<Record<BulletinEdition, string>> = {
  'zh-Hant': 'bulletin.general.zh-Hant.access',
  'zh-Hans': 'bulletin.general.zh-Hans.access',
  en: 'bulletin.general.en.access'
};

export function useAccountIdentity() {
  const account = useContext(AccountControlContext);
  return account?.auth.status === 'authenticated' ? account.auth.session.user.id : null;
}

export function useAccountAuth(): AccountAuthState {
  return useContext(AccountControlContext)?.auth ?? {status: 'checking'};
}

export function useBulletinAccess() {
  return useContext(AccountControlContext)?.bulletinAccess ?? noBulletinAccess;
}

export function useCanReadBulletin() {
  return useBulletinAccess().editions.length > 0;
}

export function useBulletinAuthorization() {
  const account = useContext(AccountControlContext);
  return useMemo(() => ({
    getAccessToken: account?.getAccessToken ?? unavailableBulletinAuthorization.getAccessToken,
    refreshAfterUnauthorized: account?.refreshAfterUnauthorized ?? unavailableBulletinAuthorization.refreshAfterUnauthorized
  }), [account?.getAccessToken, account?.refreshAfterUnauthorized]);
}

export function BulletinAccessGate({children}: {children: ReactNode}) {
  return useCanReadBulletin() ? children : null;
}

export function AccountControl(props: AccountControlProps) {
  return <AccountControlProvider {...props}><AccountControlView /></AccountControlProvider>;
}

export function AccountControlSlot(props: AccountControlProps) {
  return useContext(AccountControlContext) ? <AccountControlView /> : <AccountControl {...props} />;
}

export function AccountControlProvider({
  accountSiteUrl = accountSiteUrlForBrowser(),
  children,
  client,
  labels,
  oauth
}: AccountControlProps & {children: ReactNode}) {
  const sessionClient = useMemo(() => client ?? getSharedAccountSessionClient(), [client]);
  const resolvedOAuth = useMemo(() => oauth ?? webOAuthConfigForBrowser(), [oauth]);
  const authRuntime = useMemo(() => createBrowserAccountAuthRuntime({client: sessionClient, oauth: resolvedOAuth}), [resolvedOAuth, sessionClient]);
  const operationsClient = useMemo(() => createOperationsClient({
    baseUrl: '',
    getAccessToken: authRuntime.getAccessToken,
    refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized
  }), [authRuntime]);
  const [auth, setAuth] = useState<AccountAuthState>(authRuntime.getSnapshot());
  const [bulletinProjection, setBulletinProjection] = useState<{subject: string; access: BulletinAccess} | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const bulletinAccess = useMemo<BulletinAccess>(() => {
    if (auth.status !== 'authenticated') return noBulletinAccess;
    if (auth.session.permissionAvailability.status === 'unavailable') return {status: 'unavailable', editions: []};
    return bulletinProjection?.subject === auth.session.user.id ? bulletinProjection.access : {status: 'loading', editions: []};
  }, [auth, bulletinProjection]);

  useEffect(() => {
    const unsubscribe = authRuntime.subscribe(() => setAuth(authRuntime.getSnapshot()));
    void authRuntime.start();
    return () => { unsubscribe(); authRuntime.dispose(); };
  }, [authRuntime]);

  useEffect(() => {
    const controller = new AbortController();
    if (auth.status !== 'authenticated') {
      return () => controller.abort();
    }
    if (auth.session.permissionAvailability.status === 'unavailable') {
      return () => controller.abort();
    }

    void operationsClient.getMyAccess(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        const entitlements = new Set(snapshot.entitlements.map(({entitlementCode}) => entitlementCode));
        setBulletinProjection({
          subject: auth.session.user.id,
          access: {
            status: 'available',
            editions: bulletinEditions.filter((edition) => entitlements.has(entitlementByEdition[edition]))
          }
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        captureHandledError(error, {operation: 'operations.access'});
        setBulletinProjection({subject: auth.session.user.id, access: {status: 'unavailable', editions: []}});
      });
    return () => controller.abort();
  }, [auth, operationsClient]);

  const beginAuthorization = useCallback(async (prompt?: 'none') => {
    try {
      await authRuntime.beginSignIn(`${window.location.pathname}${window.location.search}${window.location.hash}`, {prompt});
    } catch (error) {
      captureHandledError(error, {operation: 'oauth.start'});
    }
  }, [authRuntime]);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      sessionStorage.removeItem(webPassiveSsoAttemptKey);
      return;
    }
    if (auth.status !== 'anonymous' || !shouldAttemptPassiveSso()) return;
    sessionStorage.setItem(webPassiveSsoAttemptKey, '1');
    void beginAuthorization('none');
  }, [auth.status, beginAuthorization]);

  const signOut = useCallback(async () => {
    setLogoutError('');
    try {
      await sessionClient.logoutAll();
      authRuntime.clear();
      notifyAccountStateChange('sign-out');
      return true;
    } catch (error) {
      captureHandledError(error, {operation: 'account.signout'});
      setLogoutError(labels.signOutError);
      return false;
    }
  }, [authRuntime, labels.signOutError, sessionClient]);

  return (
    <AccountControlContext.Provider value={{
      accountSiteUrl,
      auth,
      bulletinAccess,
      beginAuthorization,
      getAccessToken: authRuntime.getAccessToken,
      refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized,
      labels,
      signOut
    }}>
      {children}
      {logoutError ? <div className="fixed right-6 top-20 z-50 max-w-[min(360px,calc(100vw-32px))]"><Toast tone="danger">{logoutError}</Toast></div> : null}
    </AccountControlContext.Provider>
  );
}

export function AccountControlView() {
  const context = useContext(AccountControlContext);
  if (!context) throw new Error('AccountControlView must be used inside AccountControlProvider.');

  const {accountSiteUrl, auth, beginAuthorization, labels, signOut} = context;
  if (auth.status === 'checking' || auth.status === 'unavailable') {
    return <span className="inline-block size-10 shrink-0" aria-hidden="true" />;
  }
  if (auth.status === 'anonymous') {
    return (
      <a
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={`${accountSiteUrl}/login`}
        aria-label={labels.signIn}
        onClick={(event) => { event.preventDefault(); void beginAuthorization(); }}
      >
        <UserRound size={21} aria-hidden="true" />
      </a>
    );
  }

  const {session} = auth;
  const {user} = session;
  const displayName = user.display_name || user.email.split('@')[0] || user.email;
  const canOpenAdmin = session.permissionAvailability.status === 'available' && canAccessAdmin(session.permissions);
  return (
    <AccountMenu
      labels={{menu: labels.menu, greeting: `Hi ${displayName}`, manageAccount: labels.manageAccount, signOut: labels.signOut}}
      links={[
        {id: 'projection', label: labels.projectionSystem, href: siteConfig.apps.projection},
        ...(canOpenAdmin ? [{id: 'admin', label: labels.adminManagement, href: siteConfig.apps.admin}] : [])
      ]}
      manageAccountHref={`${accountSiteUrl}/profile`}
      onSignOut={() => void signOut()}
      user={{name: displayName, email: user.email, avatarUrl: user.avatar_url}}
    />
  );
}

export function notifyAccountStateChange(type: 'profile-changed' | 'sign-out') {
  window.dispatchEvent(new CustomEvent(accountStateEventName, {detail: {type}}));
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(accountStateEventName);
  channel.postMessage({type});
  channel.close();
}

function shouldAttemptPassiveSso() {
  return document.cookie.split(';').some((cookie) => cookie.trim() === 'hhc_sso_hint=1')
    && sessionStorage.getItem(webPassiveSsoAttemptKey) !== '1';
}

export function webOAuthConfigForBrowser(): BrowserOAuthConfig {
  const origin = typeof window === 'undefined' ? 'https://www.alive.org.tw' : window.location.origin;
  return {
    authorizeBaseUrl: accountAuthorizeBaseUrlForBrowser(),
    tokenBaseUrl: accountSessionBaseUrlForBrowser(),
    clientId: 'www-web',
    redirectUri: `${origin}/oauth/callback`,
    scope: 'openid profile email'
  };
}
