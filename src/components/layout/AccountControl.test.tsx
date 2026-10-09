import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createNavigationPresentation} from '@hallelujahhomechurch/account-client';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {AccountControl, AccountControlProvider, AccountControlView, BulletinAccessGate, useBulletinAccess, webOAuthConfigForBrowser, webPassiveSsoAttemptKey} from './AccountControl';

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
  it('links a responsible member directly to Account small group management without another access request', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(managedAccessSnapshot));
    vi.stubGlobal('fetch', fetcher);
    render(<AccountControl client={sessionClient([])} labels={labels} accountSiteUrl="https://account.alive.org.tw" />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(await screen.findByRole('menuitem', {name: 'Small group management'})).toHaveAttribute('href', 'https://account.alive.org.tw/organizations');
    const items = screen.getAllByRole('menuitem');
    expect(items.indexOf(screen.getByRole('menuitem', {name: 'Small group management'}))).toBe(items.indexOf(screen.getByRole('menuitem', {name: 'Manage account'})) + 1);
    expect(fetcher).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('menuitem', {name: 'Sign out'}));
    await screen.findByRole('link', {name: 'Sign in'});
    expect(screen.queryByRole('menuitem', {name: 'Small group management'})).not.toBeInTheDocument();
  });

  it.each([
    {...managedAccessSnapshot, responsibilities: []},
    {...managedAccessSnapshot, churchMembership: undefined}
  ])('hides small group management without active membership and responsibility', async (access) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(access)));
    render(<AccountControl client={sessionClient([])} labels={labels} />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.queryByRole('menuitem', {name: 'Small group management'})).not.toBeInTheDocument();
  });

  it.each(['revoked', 'failed', 'switched'] as const)('does not retain the management shortcut when access is %s', async (change) => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(managedAccessSnapshot));
    vi.stubGlobal('fetch', fetcher);
    const client = sessionClient([]);
    render(<AccountControl client={client} labels={labels} />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    await screen.findByRole('menuitem', {name: 'Small group management'});
    if (change === 'switched') vi.mocked(client.getSession).mockResolvedValue({authenticated: true, user: {id: 'u2', email: 'other@example.com', display_name: 'Other', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}});
    if (change === 'failed') fetcher.mockRejectedValueOnce(new Error('unavailable'));
    else fetcher.mockResolvedValueOnce(Response.json({...managedAccessSnapshot, responsibilities: []}));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('menuitem', {name: 'Small group management'})).not.toBeInTheDocument());
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
  it.each(['iam:service-principals:read', 'cms:recordings:read'])('exposes Admin for the scoped staff permission %s', async (permission) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([permission])} labels={labels} />);
    await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.getByRole('menuitem', {name: 'Admin console'})).toBeInTheDocument();
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
    expect(screen.getByRole('menuitem', {name: 'Projection system（Open in a new window）'})).toBeInTheDocument();
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
 expect((await screen.findAllByRole('menuitem')).map(item=>item.textContent)).toEqual(['Projection system','Manage account','Small group management','Admin console','Sign out']);
});

it('hides cached Admin access when current permissions are unavailable', async () => {
  const cached = createNavigationPresentation({key: 'hhc:navigation:www-web', allowedIds: ['admin', 'literature', 'member-videos']});
  cached.identify('u1'); cached.capture('u1')('account', ['admin']);
  render(<AccountControl client={sessionClient(['*'], {status: 'unavailable', code: 'permission_unavailable'})} labels={labels} />);
  await userEvent.click(await screen.findByRole('button', {name: 'Account menu'}));
  expect(screen.queryByRole('menuitem', {name: 'Admin console'})).not.toBeInTheDocument();
});
