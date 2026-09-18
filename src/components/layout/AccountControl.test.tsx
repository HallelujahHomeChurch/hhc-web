import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {AccountControl, AccountControlProvider, AccountControlView, BulletinAccessGate, webOAuthConfigForBrowser} from './AccountControl';

const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({captureHandledError}));

const labels = {
  menu: 'Account menu', projectionSystem: 'Projection system', adminManagement: 'Admin console',
  manageAccount: 'Manage account', signIn: 'Sign in', signOut: 'Sign out', signOutError: 'Unable to sign out. Try again.'
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); captureHandledError.mockClear(); });

describe('AccountControl', () => {
  it('uses the Account authority for hosted OAuth', () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNT_SITE_URL', 'https://account.alive.org.tw');

    expect(webOAuthConfigForBrowser()).toMatchObject({
      authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
      clientId: 'www-web',
      scope: 'openid profile email'
    });
  });

  it('keeps permissions: [] authenticated but does not expose Admin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)})));
    render(<AccountControl client={sessionClient([])} labels={labels} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.getByRole('menuitem', {name: 'Projection system'})).toBeInTheDocument();
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
