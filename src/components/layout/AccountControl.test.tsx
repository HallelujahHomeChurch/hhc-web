import {Dialog} from '@hallelujahhomechurch/ui';
import {OrganizationsGate} from '@/features/organizations/OrganizationsGate';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createNavigationPresentation} from '@hallelujahhomechurch/account-client';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {AccountControl, AccountControlProvider, AccountControlView, BulletinAccessGate, useBulletinAccess, useOrganizationsAccess, useAccountIdentity, webOAuthConfigForBrowser, webPassiveSsoAttemptKey} from './AccountControl';

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}));

const captureHandledError = vi.hoisted(() => vi.fn());
const offline = vi.hoisted(() => ({prepareOfflineAccount: vi.fn().mockResolvedValue(1), forgetOfflineAccount: vi.fn().mockResolvedValue(undefined), watchOfflineAccount: vi.fn(() => () => {})}));
const pending = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock('@/features/weekly-reader/offline-store', () => ({hasPendingReaderWrites: pending}));
vi.mock('@/features/weekly-reader/offline-session', () => offline);
vi.mock('@/lib/observability', () => ({captureHandledError}));

const labels = {
  menu: 'Account menu', projectionSystem: 'Projection system', projectionWindowLabel: 'Open in a new window', projectionPopupBlocked: 'Popup blocked.', adminManagement: 'Admin console',
  manageAccount: 'Manage account', organizationManagement: 'Small group management', signIn: 'Sign in', signOut: 'Sign out', signOutError: 'Unable to sign out. Try again.', unsyncedWarning: 'Unsynced changes will be removed. Continue?'
};

const managedAccessSnapshot = {
  memberDetailsEligible: true,
  churchMembership: {membershipId: 'membership-1', church: {id: 'church-1', kind: 'church', name: 'Church'}},
  memberships: [], orgRoles: [], entitlements: [],
  responsibilities: [{responsibilityId: 'responsibility-1', orgUnit: {id: 'unit-1', kind: 'small_group', name: 'Group'}}],
  version: 'a'.repeat(64)
};

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); captureHandledError.mockClear(); });

describe('AccountControl', () => {
  it('removes management from the avatar even for a delegated manager', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(managedAccessSnapshot)));
    render(<AccountControl client={sessionClient([])} labels={labels} accountSiteUrl="https://account.alive.org.tw" />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(await screen.findByRole('menuitem', {name: 'Manage account'})).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: 'Small group management'})).not.toBeInTheDocument();
  });

  it.each(['revoked', 'failed', 'switched'] as const)('refreshes delegated route access when it is %s', async change => {
    const fetcher = vi.fn(async () => Response.json(managedAccessSnapshot));
    vi.stubGlobal('fetch', fetcher);
    const client = sessionClient([]);
    function Access() { const {status} = useOrganizationsAccess(); return <p data-testid="management-access">{useAccountIdentity()}:{status}</p>; }
    render(<AccountControlProvider client={client} labels={labels}><Access /></AccountControlProvider>);
    await waitFor(() => expect(screen.getByTestId('management-access')).toHaveTextContent('u1:allowed'));
    if (change === 'switched') vi.mocked(client.getSession).mockResolvedValue({authenticated: true, user: {id: 'u2', email: 'other@example.test', display_name: 'Other', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}});
    if (change === 'failed') fetcher.mockRejectedValue(new Error('unavailable'));
    else fetcher.mockImplementation(async () => Response.json({...managedAccessSnapshot, responsibilities: []}));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(screen.getByTestId('management-access')).toHaveTextContent(change === 'failed' ? 'u1:unavailable' : `${change === 'switched' ? 'u2' : 'u1'}:denied`));
  });

  it('retries failed delegated qualification without reloading the page', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(async () => Response.json(managedAccessSnapshot));
    vi.stubGlobal('fetch', fetcher);
    function Access() {const {status, retry} = useOrganizationsAccess(); return <><p>{status}</p><button onClick={retry}>Retry access</button></>;}
    render(<AccountControlProvider client={sessionClient([])} labels={labels}><Access /></AccountControlProvider>);
    await screen.findByText('unavailable');
    await userEvent.click(screen.getByRole('button', {name: 'Retry access'}));
    await screen.findByText('allowed');
  });

  it.each(['session', 'permissions'] as const)('recovers %s transport on explicit delegated retry', async failure => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json(managedAccessSnapshot)));
    const client = sessionClient([]);
    if (failure === 'session') vi.mocked(client.getSession).mockRejectedValueOnce(new Error('offline'));
    else vi.mocked(client.getSession).mockResolvedValueOnce({authenticated: true, user: {id: 'u1', email: 'user@example.test', display_name: 'User', avatar_url: null}, permissions: [], permission_availability: {status: 'unavailable', code: 'permission_unavailable'}});
    function Access() {const {status, retry} = useOrganizationsAccess(); return <><p>{status}</p><button onClick={retry}>Retry access</button></>;}
    render(<AccountControlProvider client={client} labels={labels}><Access /></AccountControlProvider>);
    await screen.findByText('unavailable');
    await userEvent.click(screen.getByRole('button', {name: 'Retry access'}));
    await screen.findByText('allowed');
  });

  it.each(['allowed', 'revoked', 'failed'] as const)('preserves a draft during same-owner refresh, then applies %s qualification', async result => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(managedAccessSnapshot));
    vi.stubGlobal('fetch', fetcher);
    render(<AccountControlProvider client={sessionClient([])} labels={labels}><OrganizationsGate locale="en"><Dialog isOpen onOpenChange={() => {}} title="Draft notification" closeLabel="Close"><label>Draft subject<input defaultValue="" /></label></Dialog></OrganizationsGate></AccountControlProvider>);
    const input = await screen.findByRole('textbox', {name: 'Draft subject'});
    await userEvent.type(input, 'Keep my unsent draft');
    let resolve!: (value: Response) => void;
    let reject!: (error: Error) => void;
    fetcher.mockImplementation(() => new Promise<Response>((done, fail) => {resolve = done; reject = fail}));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByRole('textbox', {name: 'Draft subject'})).toHaveValue('Keep my unsent draft');
    if (result === 'failed') reject(new Error('offline'));
    else resolve(Response.json(result === 'allowed' ? managedAccessSnapshot : {...managedAccessSnapshot, responsibilities: []}));
    if (result === 'allowed') {
      await waitFor(() => expect(screen.getByRole('textbox', {name: 'Draft subject'})).toHaveValue('Keep my unsent draft'));
    } else await waitFor(() => expect(screen.queryByRole('textbox', {name: 'Draft subject'})).not.toBeInTheDocument());
  });

  it.each(['anonymous', 'other-account', 'permissions-unavailable'] as const)('requires fresh qualification after a %s session boundary', async boundary => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(managedAccessSnapshot));
    vi.stubGlobal('fetch', fetcher);
    const client = sessionClient([]);
    const original = await client.getSession();
    function Access() {return <p data-testid="qualification">{useAccountIdentity()}:{useOrganizationsAccess().status}</p>;}
    render(<AccountControlProvider client={client} labels={labels}><Access /></AccountControlProvider>);
    await waitFor(() => expect(screen.getByTestId('qualification')).toHaveTextContent('u1:allowed'));
    fetcher.mockImplementation(() => new Promise<Response>(() => {}));
    if (boundary === 'anonymous') vi.mocked(client.getSession).mockResolvedValue({authenticated:false});
    else vi.mocked(client.getSession).mockResolvedValue({...original, user:{...('user' in original ? original.user : {}), id:boundary === 'other-account' ? 'u2' : 'u1'}, permission_availability:boundary === 'permissions-unavailable' ? {status:'unavailable',code:'permission_unavailable'} : {status:'available'}} as never);
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(screen.getByTestId('qualification')).toHaveTextContent(boundary === 'anonymous' ? ':denied' : boundary === 'other-account' ? 'u2:loading' : 'u1:unavailable'));
    vi.mocked(client.getSession).mockResolvedValue(original);
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(screen.getByTestId('qualification')).toHaveTextContent('u1:loading'));
  });

  it('keeps unsynced notes and the session when the user cancels logout', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'); pending.mockResolvedValueOnce(true);
    const logoutAll = vi.fn(); const before = offline.forgetOfflineAccount.mock.calls.length;
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([], {status: 'available'}, logoutAll)} labels={labels}/>);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    await userEvent.click(screen.getByRole('menuitem', {name: 'Sign out'}));
    await waitFor(() => expect(window.confirm).toHaveBeenCalledWith(labels.unsyncedWarning));
    expect(logoutAll).not.toHaveBeenCalled(); expect(offline.forgetOfflineAccount).toHaveBeenCalledTimes(before);
    expect(screen.getByRole('button', {name: 'Account menu'})).toBeInTheDocument();
  });
  it('removes local reader data before completing explicit logout', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true');
    const logoutAll = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([], {status: 'available'}, logoutAll)} labels={labels}/>);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    await userEvent.click(screen.getByRole('menuitem', {name: 'Sign out'}));
    await screen.findByRole('link', {name: 'Sign in'});
    expect(offline.forgetOfflineAccount).toHaveBeenCalledWith('u1');
    expect(offline.forgetOfflineAccount.mock.invocationCallOrder.at(-1)).toBeLessThan(logoutAll.mock.invocationCallOrder[0]);
  });
  it.each(['*', 'iam:service-principals:read', 'cms:recordings:read'])('exposes Admin for the scoped staff permission %s', async (permission) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([permission])} labels={labels} />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.getByRole('menuitem', {name: 'Admin console'})).toBeInTheDocument();
  });
  it.each(['dsr:read', 'dsr:manage'])('hides cached Admin access after validating retired %s', async permission => {
    const cached = createNavigationPresentation({key: 'hhc:navigation:www-web', allowedIds: ['admin', 'literature', 'member-videos']});
    cached.identify('u1'); cached.capture('u1')('account', ['admin']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([permission])} labels={labels} />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.getByRole('menuitem', {name: 'Sign out'})).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: 'Admin console'})).not.toBeInTheDocument();
  });
  it('uses the Account authority for hosted OAuth', () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNT_SITE_URL', 'https://account.alive.org.tw');

    expect(webOAuthConfigForBrowser()).toMatchObject({
      authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
      tokenBaseUrl: '/api/account/v1',
      clientId: 'www-web',
      scope: 'openid profile email'
    });
  });

  it('attempts silent SSO once when the shared hint exists', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {href: 'https://www.alive.org.tw/zh-Hant', assign});
    document.cookie = 'hhc_sso_hint=1; Path=/';

    render(<AccountControl client={anonymousClient()} labels={labels} />);

    await waitFor(() => expect(assign).toHaveBeenCalledOnce());
    expect(new URL(assign.mock.calls[0][0]).searchParams.get('prompt')).toBe('none');
    expect(sessionStorage.getItem(webPassiveSsoAttemptKey)).toBe('1');
  });

  it('clears the silent SSO suppression after the local session is restored', async () => {
    sessionStorage.setItem(webPassiveSsoAttemptKey, '1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));

    render(<AccountControl client={sessionClient([])} labels={labels} />);

    await screen.findByRole('button', {name: 'Account menu'});
    await waitFor(() => expect(sessionStorage.getItem(webPassiveSsoAttemptKey)).toBeNull());
  });

  it('keeps permissions: [] authenticated but does not expose Admin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([])} labels={labels} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.queryByRole('menuitem', {name: /Projection system/})).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: 'Admin console'})).not.toBeInTheDocument();
  });

  it('projects only entitled bulletin editions and never fetches them for an anonymous visitor', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      memberships: [], orgRoles: [], qualifications: [],
      entitlements: [{assignmentId: 'e1', entitlementCode: 'bulletin.general.en.access', validFrom: '2026-09-17T00:00:00Z'}],
      version: 'a'.repeat(64)
    }));
    vi.stubGlobal('fetch', fetcher);
    const member = render(<AccountControlProvider client={sessionClient([])} labels={labels}><BulletinAccessGate><span>Member content</span></BulletinAccessGate></AccountControlProvider>);

    expect(await screen.findByText('Member content')).toBeVisible();
    expect(fetcher).toHaveBeenCalledOnce();

    member.unmount();
    fetcher.mockClear();
    render(<AccountControlProvider client={anonymousClient()} labels={labels}><AccountControlView /><BulletinAccessGate><span>Anonymous content</span></BulletinAccessGate></AccountControlProvider>);
    await waitFor(() => expect(screen.getByRole('link', {name: 'Sign in'})).toBeInTheDocument());
    expect(screen.queryByText('Anonymous content')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('offers a generic sign-in state without revealing gated bulletin content', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<AccountControlProvider client={anonymousClient()} labels={labels}><BulletinAccessGate messages={{title: 'Bulletins', loading: 'Checking access', signInRequired: 'Sign in to read', signIn: 'Sign in', unavailable: 'Unavailable'}}><span>Private issue title</span></BulletinAccessGate></AccountControlProvider>);
    expect(await screen.findByRole('button', {name: 'Sign in'})).toBeVisible();
    expect(screen.getByText('Sign in to read')).toBeVisible();
    expect(screen.queryByText('Private issue title')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('projects General and Children bulletin entitlements independently', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      memberships: [], orgRoles: [], qualifications: [],
      entitlements: [
        {assignmentId: 'e1', entitlementCode: 'bulletin.general.en.access', validFrom: '2026-09-17T00:00:00Z'},
        {assignmentId: 'e2', entitlementCode: 'bulletin.children.zh-Hant.access', validFrom: '2026-09-17T00:00:00Z'},
        {assignmentId: 'e3', entitlementCode: 'bulletin.children.zh-Hans.access', validFrom: '2026-09-17T00:00:00Z'}
      ],
      version: 'a'.repeat(64)
    })));

    function AccessProjection() { return <output>{JSON.stringify(useBulletinAccess().editions)}</output>; }
    render(<AccountControlProvider client={sessionClient([])} labels={labels}><AccessProjection /></AccountControlProvider>);

    expect(await screen.findByText('[{"series":"general","locale":"en"},{"series":"children","locale":"zh-Hant"}]')).toBeInTheDocument();
  });

  it('keeps an authenticated identity when permission transport is unavailable while failing bulletin discovery closed', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    render(<AccountControlProvider client={sessionClient([], {status: 'unavailable', code: 'permission_unavailable'})} labels={labels}><AccountControlView /><BulletinAccessGate><span>Member content</span></BulletinAccessGate></AccountControlProvider>);

    expect(await screen.findByRole('button', {name: 'Account menu'})).toBeInTheDocument();
    expect(screen.queryByText('Member content')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('only changes to anonymous after logout succeeds', async () => {
    const logoutAll = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([], {status: 'available'}, logoutAll)} labels={labels} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {name: 'Account menu'}));
    await user.click(screen.getByRole('menuitem', {name: 'Sign out'}));
    expect(logoutAll).toHaveBeenCalledOnce();
    expect(await screen.findByRole('link', {name: 'Sign in'})).toBeInTheDocument();
  });
});



function anonymousClient(): AccountSessionClient {
  return {
    getSession: vi.fn().mockResolvedValue({authenticated: false}),
    issueAccessToken: vi.fn(), refreshAccessToken: vi.fn(), logout: vi.fn(), logoutAll: vi.fn()
  };
}

function sessionClient(permissions: string[], permissionAvailability: {status: 'available'} | {status: 'unavailable'; code: 'permission_unavailable'} = {status: 'available'}, logoutAll = vi.fn().mockResolvedValue(undefined)): AccountSessionClient {
  return {
    getSession: vi.fn().mockResolvedValue({
      authenticated: true,
      user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null},
      permissions,
      permission_availability: permissionAvailability
    }),
    issueAccessToken: vi.fn().mockResolvedValue({accessToken: 'token', expiresIn: 900}),
    refreshAccessToken: vi.fn().mockResolvedValue({accessToken: 'token-2', expiresIn: 900}),
    logout: vi.fn(),
    logoutAll
  };
}

it('orders account, organizations, admin before sign-out and hides the current website',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(managedAccessSnapshot)));
 render(<AccountControl client={sessionClient(['*'])} labels={labels} accountSiteUrl="https://account.alive.org.tw"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Account menu'}));
 expect((await screen.findAllByRole('menuitem')).map(item=>item.textContent)).toEqual(['Manage account','Admin console','Sign out']);
});

it('hides cached Admin access when current permissions are unavailable', async () => {
  const cached = createNavigationPresentation({key: 'hhc:navigation:www-web', allowedIds: ['admin', 'literature', 'member-videos']});
  cached.identify('u1'); cached.capture('u1')('account', ['admin']);
  render(<AccountControl client={sessionClient(['*'], {status: 'unavailable', code: 'permission_unavailable'})} labels={labels} />);
  await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
  expect(screen.queryByRole('menuitem', {name: 'Admin console'})).not.toBeInTheDocument();
});

it.each([
 ['small_group', true, 'allowed'],
 ['small_group', false, 'denied'],
 ['family', true, 'denied'],
 ['fellowship', true, 'denied'],
])('projects direct %s membership with church=%s as %s', async (kind, church, expected) => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...managedAccessSnapshot,
  churchMembership: church ? managedAccessSnapshot.churchMembership : undefined,
  responsibilities:[], memberships:[{membershipId:'direct',orgUnit:{id:'unit',name:'Unit',kind}}],
 })))
 function Access() {return <output>{useOrganizationsAccess().status}</output>}
 render(<AccountControlProvider client={sessionClient([])} labels={labels}><Access /></AccountControlProvider>)
 expect(await screen.findByText(expected)).toBeInTheDocument()
})

it('uses a page-provided bulletin loading fallback without mounting private children or a nested main',()=>{
 const view=render(<main><BulletinAccessGate loadingFallback={<p>Bulletin skeleton</p>} messages={{title:'Bulletins',loading:'Checking',signInRequired:'Sign in',signIn:'Sign in',unavailable:'Unavailable'}}><p>Private issue</p></BulletinAccessGate></main>);
 expect(screen.getByText('Bulletin skeleton')).toBeInTheDocument();
 expect(screen.queryByText('Private issue')).not.toBeInTheDocument();
 expect(view.container.querySelectorAll('main')).toHaveLength(1);
});
