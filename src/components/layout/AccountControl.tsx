'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {
  buildAuthorizeUrl,
  canAccessAdmin,
  hasPermission,
  isPermissionList,
  createOAuthTransactionOnce,
  currentReturnTo,
  resolveAccountAuth,
  type AccountSessionUser,
  type AccountSessionClient,
  type OAuthClientConfig
} from '@hallelujahhomechurch/account-client';
import {AccountMenu, Toast} from '@hallelujahhomechurch/ui';
import {clearSharedAccountSession, getSharedAccountSessionClient, revalidateSharedAccountSession} from '@/lib/browser-bootstrap';
import {createHhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {siteConfig} from '@/lib/site';

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
  projectionSystem: string;
  adminManagement: string;
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

type AccountControlContextValue = {
  accountSiteUrl: string;
  auth: AccountControlState;
  bulletinCanRead: boolean;
  bulletinPublicEnabled: boolean | null;
  beginAuthorization: () => void;
  labels: AccountControlLabels;
  signOut: () => Promise<boolean>;
};

const AccountControlContext = createContext<AccountControlContextValue | null>(null);

export function useAccountIdentity() {
  const account = useContext(AccountControlContext);
  return account?.auth.status === 'authenticated' ? account.auth.user.id : null;
}

export function useCanReadBulletin(publicEnabled: boolean) {
  const account = useContext(AccountControlContext);
  return (account?.bulletinPublicEnabled ?? publicEnabled) || (account?.auth.status === 'authenticated' && hasPermission(account.auth.user.permissions, 'bulletin:read') && account.bulletinCanRead);
}

export function useBulletinMemberMode(initialMode: boolean) {
  const account = useContext(AccountControlContext);
  return account?.bulletinPublicEnabled == null ? initialMode : !account.bulletinPublicEnabled;
}

export function BulletinAccessGate({children, publicEnabled}: {children: ReactNode; publicEnabled: boolean}) {
  return useCanReadBulletin(publicEnabled) ? children : null;
}

export function AccountControl(props: AccountControlProps) {
  return (
    <AccountControlProvider {...props}>
      <AccountControlView />
    </AccountControlProvider>
  );
}

export function AccountControlSlot(props: AccountControlProps) {
  return useContext(AccountControlContext) ? <AccountControlView /> : <AccountControl {...props} />;
}

export function AccountControlProvider({
  accountSiteUrl = accountSiteUrlForBrowser(),
  children,
  client,
  labels,
  navigateExternal = defaultNavigateExternal,
  oauth
}: AccountControlProps & {children: ReactNode}) {
  const sessionClient = useMemo(() => client ?? getSharedAccountSessionClient(), [client]);
  const oauthConfig = useMemo(() => oauth ?? webOAuthConfigForBrowser(), [oauth]);
  const [auth, setAuth] = useState<AccountControlState>({status: 'loading'});
  const [bulletinCanRead, setBulletinCanRead] = useState(false);
  const [bulletinSubject, setBulletinSubject] = useState<string | null>(null);
  const [bulletinPublicEnabled, setBulletinPublicEnabled] = useState<boolean | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const requestRevision = useRef(0);
  const authorizationStarted = useRef(false);

  const refreshSession = useCallback(async (force = false) => {
    const revision = ++requestRevision.current;
    let sharedSignOutFailed = false;
    let result = await resolveAccountAuth(force && !client ? {getSession: revalidateSharedAccountSession} : sessionClient);
    if (result.status === 'authenticated' && hasSharedSignOut()) {
      try {
        await sessionClient.logoutAll();
        if (!client) clearSharedAccountSession();
        notifyAccountStateChange('sign-out');
        result = {status: 'anonymous'};
      } catch (error) {
        sharedSignOutFailed = true;
        if (!client) clearSharedAccountSession();
        result = {status: 'unavailable', error: error instanceof Error ? error : new Error('Unable to clear account session')};
      }
    }
    if (revision !== requestRevision.current) return result;

    const invalidPermissions = result.status === 'authenticated' && !isPermissionList(result.user.permissions);
    if (result.status === 'authenticated') {
      sessionStorage.removeItem(webPassiveSsoAttemptKey);
    }
    setAuth((current) => {
      if (invalidPermissions) return {status: 'unavailable'};
      if (result.status === 'authenticated') return {status: 'authenticated', user: result.user};
      if (result.status === 'anonymous') return {status: 'anonymous'};
      return !sharedSignOutFailed && current.status === 'authenticated' ? current : {status: 'unavailable'};
    });
    return invalidPermissions
      ? {status: 'unavailable' as const, error: new Error('Invalid account permissions')}
      : result;
  }, [client, sessionClient]);

  useEffect(() => {
    const controller = new AbortController();
    async function refreshBulletinAccess() {
      if (auth.status === 'loading') return;
      let canRead = false;
      let publicEnabled = false;
      try {
        if (auth.status === 'authenticated' && hasPermission(auth.user.permissions, 'bulletin:read')) {
          const {accessToken} = await sessionClient.issueAccessToken();
          if (controller.signal.aborted) return;
          const api = createHhcWebClient({baseUrl: '/api', getAccessToken: () => accessToken});
          const access = await api.getMemberBulletinAccess(controller.signal);
          canRead = access.canRead; publicEnabled = access.publicEnabled;
        } else {
          publicEnabled = (await createHhcWebClient({baseUrl: '/api', getAccessToken: () => null}).getBulletinAccess(controller.signal)).enabled;
        }
      } catch { /* Live availability fails closed; the account menu stays usable. */ }
      if (!controller.signal.aborted) {setBulletinCanRead(canRead); setBulletinSubject(auth.status === 'authenticated' ? auth.user.id : null); setBulletinPublicEnabled(publicEnabled);}
    }
    void refreshBulletinAccess();
    return () => controller.abort();
  }, [auth, sessionClient]);

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
      timer = setTimeout(() => void refreshSession(true), 100);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleRefresh();
    };
    const onAccountState = () => {setBulletinCanRead(false); scheduleRefresh();};
    const channel = typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(accountStateEventName);

    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener(accountStateEventName, onAccountState);
    document.addEventListener('visibilitychange', onVisibilityChange);
    channel?.addEventListener('message', onAccountState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', scheduleRefresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener(accountStateEventName, onAccountState);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      channel?.close();
    };
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    setLogoutError('');
    try {
      await sessionClient.logoutAll();
      if (!client) clearSharedAccountSession();
      setAuth({status: 'anonymous'});
      setBulletinCanRead(false);
      notifyAccountStateChange('sign-out');
      return true;
    } catch {
      const result = await refreshSession();
      if (result.status === 'anonymous') {
        notifyAccountStateChange('sign-out');
        return true;
      }
      setLogoutError(labels.signOutError);
      return false;
    }
  }, [client, labels.signOutError, refreshSession, sessionClient]);

  return (
    <AccountControlContext.Provider value={{accountSiteUrl, auth, bulletinCanRead: bulletinCanRead && auth.status === 'authenticated' && bulletinSubject === auth.user.id, bulletinPublicEnabled, beginAuthorization, labels, signOut}}>
      {children}
      {logoutError ? (
        <div className="fixed right-6 top-20 z-50 max-w-[min(360px,calc(100vw-32px))]">
          <Toast tone="danger">{logoutError}</Toast>
        </div>
      ) : null}
    </AccountControlContext.Provider>
  );
}

export function AccountControlView() {
  const context = useContext(AccountControlContext);
  if (!context) throw new Error('AccountControlView must be used inside AccountControlProvider.');

  const {accountSiteUrl, auth, beginAuthorization, labels, signOut} = context;

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
    <AccountMenu
      labels={{
        menu: labels.menu,
        greeting: `Hi ${displayName}`,
        manageAccount: labels.manageAccount,
        signOut: labels.signOut
      }}
      links={[
        {id: 'projection', label: labels.projectionSystem, href: siteConfig.apps.projection},
        ...(canAccessAdmin(user.permissions ?? [])
          ? [{id: 'admin', label: labels.adminManagement, href: siteConfig.apps.admin}]
          : [])
      ]}
      manageAccountHref={`${accountSiteUrl}/profile`}
      onSignOut={() => void signOut()}
      user={{
        name: displayName,
        email: user.email,
        avatarUrl: user.avatar_url
      }}
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
  return hasSsoHint() && sessionStorage.getItem(webPassiveSsoAttemptKey) !== '1';
}

function hasSsoHint() {
  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim() === 'hhc_sso_hint=1');
}

function hasSharedSignOut() {
  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim() === 'hhc_sso_hint=0');
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
    scope: 'openid profile email bulletin:read'
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
