'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {
  createBrowserAccountAuthRuntime,
  createNavigationPresentation,
  emptyNavigationPresentation,
  type NavigationPresentation,
  type AccountAuthState,
  type AccountSessionClient,
  type BrowserOAuthConfig
} from '@hallelujahhomechurch/account-client';
import {canAccessAdmin} from '@hallelujahhomechurch/account-client/admin-access';
import {createOperationsClient} from '@hallelujahhomechurch/operations-client';
import {bulletinEditions, type BulletinEdition} from '@hallelujahhomechurch/preferences';
import {AccountMenu, Toast} from '@hallelujahhomechurch/ui';
import {captureHandledError} from '@/lib/observability';
import {recordAccountAuthEvent} from '@/lib/account-observability';
import {getSharedAccountSessionClient} from '@/lib/browser-bootstrap';
import {accountAuthorizeBaseUrlForBrowser, accountSessionBaseUrlForBrowser, accountSiteUrlForBrowser} from '@/lib/account-origin';
import {siteConfig} from '@/lib/site';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';

export const accountStateEventName = 'hhc:account-state';
export const webPassiveSsoAttemptKey = 'hhc_web_passive_sso_attempted';

type AccountControlLabels = {
  menu: string;
  projectionSystem: string;
  projectionWindowLabel: string;
  projectionPopupBlocked: string;
  adminManagement: string;
  manageAccount: string;
  organizationManagement: string;
  signIn: string;
  signOut: string;
  signOutError: string;
  unsyncedWarning: string;
};

type BulletinAccess =
  | {status: 'loading'; editions: readonly BulletinEdition[]}
  | {status: 'available'; editions: readonly BulletinEdition[]}
  | {status: 'unavailable'; editions: readonly BulletinEdition[]};

type VideoAccess = 'loading' | 'available' | 'denied' | 'unavailable';

type AccountControlProps = {
  accountSiteUrl?: string;
  client?: AccountSessionClient;
  labels: AccountControlLabels;
  oauth?: BrowserOAuthConfig;
};

type AccountControlContextValue = {
  accountSiteUrl: string;
  auth: AccountAuthState;
  navigation: NavigationPresentation;
  canManageOrganizations: boolean;
  bulletinAccess: BulletinAccess;
  videoAccess: VideoAccess;
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
const entitlementByEdition = new Map(bulletinEditions.map(({series, locale}) => [`${series}/${locale}`, `bulletin.${series}.${locale}.access`]));

export function useAccountIdentity() {
  const account = useContext(AccountControlContext);
  return account?.auth.status === 'authenticated' ? account.auth.session.user.id : null;
}

export function useAccountSignIn() {
  return useContext(AccountControlContext)?.beginAuthorization;
}

export function useAccountAuth(): AccountAuthState {
  return useContext(AccountControlContext)?.auth ?? {status: 'checking'};
}

export function useBulletinAccess() {
  return useContext(AccountControlContext)?.bulletinAccess ?? noBulletinAccess;
}

export function useVideoAccess(): VideoAccess {
  return useContext(AccountControlContext)?.videoAccess ?? 'loading';
}

export function useCanReadBulletin() {
  return useBulletinAccess().editions.length > 0;
}

export function useNavigationPresentation() {
  return useContext(AccountControlContext)?.navigation ?? {...emptyNavigationPresentation, ready: true};
}

export function useBulletinAuthorization() {
  const account = useContext(AccountControlContext);
  return useMemo(() => ({
    getAccessToken: account?.getAccessToken ?? unavailableBulletinAuthorization.getAccessToken,
    refreshAfterUnauthorized: account?.refreshAfterUnauthorized ?? unavailableBulletinAuthorization.refreshAfterUnauthorized
  }), [account?.getAccessToken, account?.refreshAfterUnauthorized]);
}

export function BulletinAccessGate({children, messages}: {children: ReactNode; messages?: {title: string; loading: string; signInRequired: string; signIn: string; unavailable: string}}) {
  const access = useBulletinAccess();
  const auth = useAccountAuth();
  const signIn = useAccountSignIn();
  if (access.status === 'available' && access.editions.length) return children;
  if (!messages) return null;
  const checking = auth.status === 'checking' || access.status === 'loading';
  return <main className="shell py-16"><section className="rounded-2xl border border-panel-border bg-paper p-8 text-center" role="status">
    <h1 className="text-2xl font-semibold">{messages.title}</h1>
    <p className="mt-4 text-muted">{checking ? messages.loading : auth.status === 'anonymous' ? messages.signInRequired : messages.unavailable}</p>
    {!checking && auth.status === 'anonymous' ? <button type="button" className="mt-5 min-h-11 rounded-full bg-primary-solid px-5 font-semibold text-primary-foreground" onClick={() => void signIn?.()}>{messages.signIn}</button> : null}
  </section></main>;
}

export function AccountControl(props: AccountControlProps) {
  return <AccountControlProvider {...props}><AccountControlView /></AccountControlProvider>;
}

export function AccountControlScope({children, ...props}: AccountControlProps & {children: ReactNode}) {
  return useContext(AccountControlContext) ? children : <AccountControlProvider {...props}>{children}</AccountControlProvider>;
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
  const presentation = useMemo(() => createNavigationPresentation({key: 'hhc:navigation:www-web', allowedIds: ['account', 'admin', 'literature-ministry', 'member-videos']}), []);
  const navigation = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, () => emptyNavigationPresentation);
  const authRuntime = useMemo(() => createBrowserAccountAuthRuntime({client: sessionClient, oauth: resolvedOAuth, presentation, onEvent: recordAccountAuthEvent}), [resolvedOAuth, sessionClient, presentation]);
  const operationsClient = useMemo(() => createOperationsClient({
    baseUrl: '',
    getAccessToken: authRuntime.getAccessToken,
    refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized
  }), [authRuntime]);
  const [auth, setAuth] = useState<AccountAuthState>(authRuntime.getSnapshot());
  const [bulletinProjection, setBulletinProjection] = useState<{subject: string; access: BulletinAccess} | null>(null);
  const [videoProjection, setVideoProjection] = useState<{subject: string; access: VideoAccess} | null>(null);
  const [managedProjection, setManagedProjection] = useState<{session: AccountAuthState; allowed: boolean} | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const readerAccountId = auth.status === 'authenticated' ? auth.session.user.id : null;
  useEffect(() => {
    if (!isWeeklyReaderEnabled()) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void import('@/features/weekly-reader/offline-session').then(async offline => {
      if (disposed) return;
      stop = offline.watchOfflineAccount(accountId => {
        if (readerAccountId && accountId !== readerAccountId) authRuntime.clear();
      }, true);
      if (readerAccountId) await offline.prepareOfflineAccount(readerAccountId);
    }).catch(() => { /* Online access remains available when local storage is unavailable. */ });
    return () => {disposed = true; stop?.();};
  }, [readerAccountId, authRuntime]);
  const bulletinAccess = useMemo<BulletinAccess>(() => {
    if (auth.status !== 'authenticated') return noBulletinAccess;
    if (auth.session.permissionAvailability.status === 'unavailable') return {status: 'unavailable', editions: []};
    return bulletinProjection?.subject === auth.session.user.id ? bulletinProjection.access : {status: 'loading', editions: []};
  }, [auth, bulletinProjection]);
  const videoAccess: VideoAccess = auth.status !== 'authenticated' ? 'loading'
    : auth.session.permissionAvailability.status === 'unavailable' ? 'unavailable'
      : videoProjection?.subject === auth.session.user.id ? videoProjection.access : 'loading';
  const canManageOrganizations = auth.status === 'authenticated'
    && auth.session.permissionAvailability.status === 'available'
    && managedProjection?.session === auth && managedProjection.allowed;

  useEffect(() => {
    const unsubscribe = authRuntime.subscribe(() => {
      const next = authRuntime.getSnapshot();
      if (next.status === 'authenticated' && next.session.permissionAvailability.status === 'available') {
        presentation.capture(next.session.user.id)('account', ['account', ...(canAccessAdmin(next.session.permissions) ? ['admin'] : [])]);
      }
      setAuth(next);
    });
    void authRuntime.start();
    return () => { unsubscribe(); authRuntime.dispose(); };
  }, [authRuntime, presentation]);

  useEffect(() => {
    const controller = new AbortController();
    if (auth.status !== 'authenticated') {
      return () => controller.abort();
    }
    if (auth.session.permissionAvailability.status === 'unavailable') {
      return () => controller.abort();
    }

    const commitNavigation = presentation.capture(auth.session.user.id);
    void operationsClient.getMyAccess(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        const entitlements = new Set(snapshot.entitlements.map(({entitlementCode}) => entitlementCode));
        const editions = bulletinEditions.filter(({series, locale}) => entitlements.has(entitlementByEdition.get(`${series}/${locale}`)!));
        if (!commitNavigation('operations', [...(editions.length ? ['literature-ministry'] : []), ...(entitlements.has('video.meeting-recordings.access') ? ['member-videos'] : [])])) return;
        setManagedProjection({session: auth, allowed: Boolean(snapshot.churchMembership && snapshot.responsibilities.length > 0)});
        setBulletinProjection({
          subject: auth.session.user.id,
          access: {
            status: 'available',
            editions
          }
        });
        setVideoProjection({subject: auth.session.user.id, access: entitlements.has('video.meeting-recordings.access') ? 'available' : 'denied'});
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        captureHandledError(error, {operation: 'operations.access'});
        setBulletinProjection({subject: auth.session.user.id, access: {status: 'unavailable', editions: []}});
        setVideoProjection({subject: auth.session.user.id, access: 'unavailable'});
      });
    return () => controller.abort();
  }, [auth, operationsClient, presentation]);

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
      if (isWeeklyReaderEnabled() && readerAccountId) {
        const {hasPendingReaderWrites} = await import('@/features/weekly-reader/offline-store');
        if (await hasPendingReaderWrites(readerAccountId) && !window.confirm(labels.unsyncedWarning)) return false;
        const offline = await import('@/features/weekly-reader/offline-session');
        await offline.forgetOfflineAccount(readerAccountId);
      }
      await authRuntime.signOut();
      notifyAccountStateChange('sign-out');
      return true;
    } catch (error) {
      captureHandledError(error, {operation: 'account.signout'});
      setLogoutError(labels.signOutError);
      return false;
    }
  }, [authRuntime, labels.signOutError, labels.unsyncedWarning, readerAccountId]);

  return (
    <AccountControlContext.Provider value={{
      accountSiteUrl,
      auth,
      navigation,
      canManageOrganizations,
      bulletinAccess,
      videoAccess,
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

export function AccountControlView({menuLabel}: {menuLabel?: string} = {}) {
  const context = useContext(AccountControlContext);
  if (!context) throw new Error('AccountControlView must be used inside AccountControlProvider.');

  const {accountSiteUrl, auth, navigation, canManageOrganizations, beginAuthorization, labels, signOut} = context;
  if ((auth.status === 'checking' || auth.status === 'unavailable') && !navigation.subjectId) {
    return <span className="inline-block size-10 shrink-0" aria-hidden="true" />;
  }
  if (auth.status === 'anonymous') {
    return (
      <a
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={`${accountSiteUrl}/login`}
        aria-label={menuLabel ?? labels.signIn}
        onClick={(event) => { event.preventDefault(); void beginAuthorization(); }}
      >
        <UserRound size={21} aria-hidden="true" />
      </a>
    );
  }

  const user = auth.status === 'authenticated' ? auth.session.user : null;
  const displayName = user ? user.display_name || user.email.split('@')[0] || user.email : '';
  const canOpenAdmin = auth.status === 'authenticated' && auth.session.permissionAvailability.status === 'available' && canAccessAdmin(auth.session.permissions);
  return (
    <AccountMenu
      labels={{menu: menuLabel ?? labels.menu, greeting: displayName ? `Hi ${displayName}` : labels.manageAccount, manageAccount: labels.manageAccount, signOut: labels.signOut}}
      links={[
        {id: 'projection', label: labels.projectionSystem, href: siteConfig.apps.projection, newWindow: {label: labels.projectionWindowLabel, blockedMessage: labels.projectionPopupBlocked}},
        {id: 'manage', label: labels.manageAccount, href: `${accountSiteUrl}/profile`},
        ...(canManageOrganizations ? [{id: 'organizations', label: labels.organizationManagement, href: `${accountSiteUrl}/organizations`}] : []),
        ...(canOpenAdmin ? [{id: 'admin', label: labels.adminManagement, href: siteConfig.apps.admin}] : [])
      ]}
      onSignOut={() => void signOut()}
      user={{name: displayName, email: user?.email ?? '', avatarUrl: user ? user.avatar_url : '/assets/brand/account-placeholder.svg'}}
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
