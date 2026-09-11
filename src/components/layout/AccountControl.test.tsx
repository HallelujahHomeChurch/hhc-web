import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {AccountControl, AccountControlProvider, BulletinAccessGate, useBulletinMemberMode, accountStateEventName} from './AccountControl';

const labels = {
  menu: 'Account menu',
  projectionSystem: 'Projection system',
  adminManagement: 'Admin console',
  manageAccount: 'Manage account',
  signIn: 'Sign in',
  signOut: 'Sign out',
  signOutError: 'Unable to sign out. Try again.'
};

const oauth = {
  authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
  clientId: 'www-web',
  redirectUri: 'https://www.alive.org.tw/oauth/callback',
  scope: 'openid profile email'
};

function anonymousClient(): AccountSessionClient {
  return {
    getSession: vi.fn().mockResolvedValue({authenticated: false}),
    issueAccessToken: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn()
  };
}

function authenticatedClient(adminAccess = false, logoutAll = vi.fn().mockResolvedValue(undefined)): AccountSessionClient {
  return {
    getSession: vi.fn().mockResolvedValue({
      authenticated: true,
      user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null, permissions: adminAccess ? ['dsr:read'] : []}
    }),
    issueAccessToken: vi.fn(),
    logout: vi.fn(),
    logoutAll
  };
}

describe('AccountControl', () => {
  beforeEach(() => {
    document.cookie = 'hhc_sso_hint=; Max-Age=0; Path=/';
    sessionStorage.clear();
    window.history.replaceState({}, '', '/en/about?source=header#account');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders sign in without a passive redirect when no SSO hint exists', async () => {
    const navigateExternal = vi.fn();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={anonymousClient()}
        labels={labels}
        navigateExternal={navigateExternal}
        oauth={oauth}
      />
    );

    expect(await screen.findByRole('link', {name: 'Sign in'})).toHaveAttribute(
      'href',
      'https://account.alive.org.tw/login'
    );
    expect(navigateExternal).not.toHaveBeenCalled();
  });

  it('does not present an unavailable session endpoint as signed out', async () => {
    const client = anonymousClient();
    vi.mocked(client.getSession).mockRejectedValue(new Error('unavailable'));

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={client}
        labels={labels}
        navigateExternal={vi.fn()}
        oauth={oauth}
      />
    );

    await waitFor(() => expect(client.getSession).toHaveBeenCalledOnce());
    expect(screen.queryByRole('link', {name: 'Sign in'})).not.toBeInTheDocument();
  });

  it('starts interactive OAuth from sign in and preserves the current URL', async () => {
    const user = userEvent.setup();
    const navigateExternal = vi.fn();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={anonymousClient()}
        labels={labels}
        navigateExternal={navigateExternal}
        oauth={oauth}
      />
    );

    await user.click(await screen.findByRole('link', {name: 'Sign in'}));

    await waitFor(() => expect(navigateExternal).toHaveBeenCalledOnce());
    const authorizeUrl = new URL(navigateExternal.mock.calls[0][0]);
    expect(authorizeUrl.searchParams.has('prompt')).toBe(false);
    expect(sessionStorage.getItem('hhc_web_oauth_transaction')).toContain(
      '/en/about?source=header#account'
    );
  });

  it('starts interactive OAuth only once when sign in is clicked repeatedly', async () => {
    const user = userEvent.setup();
    const navigateExternal = vi.fn();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={anonymousClient()}
        labels={labels}
        navigateExternal={navigateExternal}
        oauth={oauth}
      />
    );

    const signIn = await screen.findByRole('link', {name: 'Sign in'});
    await Promise.all([user.click(signIn), user.click(signIn)]);

    await waitFor(() => expect(navigateExternal).toHaveBeenCalledOnce());
  });

  it('attempts prompt=none once when the SSO hint exists', async () => {
    document.cookie = 'hhc_sso_hint=1; Path=/';
    const navigateExternal = vi.fn();

    render(
      <AccountControl
        client={anonymousClient()}
        labels={labels}
        navigateExternal={navigateExternal}
        oauth={oauth}
      />
    );

    await waitFor(() => expect(navigateExternal).toHaveBeenCalledOnce());
    const authorizeUrl = new URL(navigateExternal.mock.calls[0][0]);
    expect(authorizeUrl.searchParams.get('prompt')).toBe('none');
    expect(authorizeUrl.searchParams.get('client_id')).toBe('www-web');
    expect(sessionStorage.getItem('hhc_web_passive_sso_attempted')).toBe('1');
    expect(sessionStorage.getItem('hhc_web_oauth_transaction')).toContain(
      '/en/about?source=header#account'
    );
  });

  it('does not repeat passive authorization after the attempt marker is set', async () => {
    document.cookie = 'hhc_sso_hint=1; Path=/';
    sessionStorage.setItem('hhc_web_passive_sso_attempted', '1');
    const navigateExternal = vi.fn();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={anonymousClient()}
        labels={labels}
        navigateExternal={navigateExternal}
        oauth={oauth}
      />
    );

    expect(await screen.findByRole('link', {name: 'Sign in'})).toBeInTheDocument();
    expect(navigateExternal).not.toHaveBeenCalled();
  });

  it('shows the projection system but not admin management for a non-admin user', async () => {
    const user = userEvent.setup();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={authenticatedClient(false)}
        labels={labels}
      />
    );

    await user.click(await screen.findByRole('button', {name: 'Account menu'}));

    expect(screen.getByRole('menuitem', {name: 'Projection system'})).toHaveAttribute(
      'href',
      'https://client.alive.org.tw/'
    );
    expect(screen.queryByRole('menuitem', {name: 'Admin console'})).not.toBeInTheDocument();
  });

  it('orders admin management between the projection system and account actions for an admin user', async () => {
    const user = userEvent.setup();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={authenticatedClient(true)}
        labels={labels}
      />
    );

    await user.click(await screen.findByRole('button', {name: 'Account menu'}));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Projection system', 'Admin console', 'Manage account', 'Sign out'
    ]);
    expect(screen.getByRole('menuitem', {name: 'Admin console'})).toHaveAttribute(
      'href',
      'https://admin.alive.org.tw/'
    );
  });

  it('keeps the account menu visible when global sign out fails', async () => {
    const user = userEvent.setup();
    const logoutAll = vi.fn().mockRejectedValue(new Error('unavailable'));

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={authenticatedClient(false, logoutAll)}
        labels={labels}
      />
    );

    await user.click(await screen.findByRole('button', {name: 'Account menu'}));
    await user.click(screen.getByRole('menuitem', {name: 'Sign out'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign out. Try again.');
    expect(screen.getByRole('button', {name: 'Account menu'})).toBeInTheDocument();
  });

  it('updates the header only after current-device global sign out succeeds', async () => {
    const user = userEvent.setup();
    const logoutAll = vi.fn().mockResolvedValue(undefined);

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={authenticatedClient(false, logoutAll)}
        labels={labels}
      />
    );

    await user.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    const manageAccount = screen.getByRole('menuitem', {name: 'Manage account'});
    const signOut = screen.getByRole('menuitem', {name: 'Sign out'});
    expect(manageAccount).toHaveClass('hhc-menu__item', 'hhc-menu__item--default');
    expect(signOut).toHaveClass('hhc-menu__item', 'hhc-menu__item--danger');
    expect(manageAccount).toHaveAttribute(
      'href',
      'https://account.alive.org.tw/profile'
    );
    await user.click(signOut);

    expect(logoutAll).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('link', {name: 'Sign in'})).toBeInTheDocument());
  });

  it('revalidates the public header when the page regains focus', async () => {
    const client = authenticatedClient();
    vi.mocked(client.getSession)
      .mockResolvedValueOnce({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null, permissions: []}
      })
      .mockResolvedValueOnce({authenticated: false});

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={client}
        labels={labels}
      />
    );

    expect(await screen.findByRole('button', {name: 'Account menu'})).toBeInTheDocument();
    fireEvent.focus(window);

    await waitFor(() => expect(screen.getByRole('link', {name: 'Sign in'})).toBeInTheDocument());
    expect(client.getSession).toHaveBeenCalledTimes(2);
  });

  it('clears a host session when another HHC site publishes the shared sign-out marker', async () => {
    document.cookie = 'hhc_sso_hint=1; Path=/';
    const client = authenticatedClient();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={client}
        labels={labels}
      />
    );

    expect(await screen.findByRole('button', {name: 'Account menu'})).toBeInTheDocument();
    document.cookie = 'hhc_sso_hint=0; Path=/';
    fireEvent.focus(window);

    await waitFor(() => expect(screen.getByRole('link', {name: 'Sign in'})).toBeInTheDocument());
    expect(client.logoutAll).toHaveBeenCalledOnce();
  });

  it('hides a stale account menu when host cleanup after shared sign-out fails', async () => {
    const client = authenticatedClient(false, vi.fn().mockRejectedValue(new Error('network unavailable')));

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={client}
        labels={labels}
      />
    );

    expect(await screen.findByRole('button', {name: 'Account menu'})).toBeInTheDocument();
    document.cookie = 'hhc_sso_hint=0; Path=/';
    fireEvent.focus(window);

    await waitFor(() => expect(screen.queryByRole('button', {name: 'Account menu'})).not.toBeInTheDocument());
    expect(screen.queryByRole('link', {name: 'Sign in'})).not.toBeInTheDocument();
    expect(client.logoutAll).toHaveBeenCalledOnce();
  });

  it('revalidates only when pageshow restores a BFCache page', async () => {
    const client = authenticatedClient();

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={client}
        labels={labels}
      />
    );

    expect(await screen.findByRole('button', {name: 'Account menu'})).toBeInTheDocument();
    const initialPageShow = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(initialPageShow, 'persisted', {value: false});
    window.dispatchEvent(initialPageShow);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(client.getSession).toHaveBeenCalledTimes(1);

    const restoredPageShow = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(restoredPageShow, 'persisted', {value: true});
    window.dispatchEvent(restoredPageShow);
    await waitFor(() => expect(client.getSession).toHaveBeenCalledTimes(2));
  });

  it('revalidates when another same-origin account control reports sign out', async () => {
    const client = authenticatedClient();
    vi.mocked(client.getSession)
      .mockResolvedValueOnce({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null, permissions: []}
      })
      .mockResolvedValueOnce({authenticated: false});

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={client}
        labels={labels}
      />
    );

    expect(await screen.findByRole('button', {name: 'Account menu'})).toBeInTheDocument();
    window.dispatchEvent(new CustomEvent(accountStateEventName, {detail: {type: 'sign-out'}}));

    await waitFor(() => expect(screen.getByRole('link', {name: 'Sign in'})).toBeInTheDocument());
  });

  it.each([
    ['direct sign out', async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', {name: 'Account menu'}));
      await user.click(screen.getByRole('menuitem', {name: 'Sign out'}));
    }],
    ['focus revalidation', async () => {
      fireEvent.focus(window);
    }],
    ['an account-state event', async () => {
      window.dispatchEvent(new CustomEvent(accountStateEventName, {detail: {type: 'sign-out'}}));
    }]
  ])('replaces the closed member page after %s makes the account anonymous', async (_trigger, trigger) => {
    window.history.replaceState({}, '', '/zh-Hant/literature-ministry');
    const browserWindow = window;
    const replace = vi.fn();
    vi.stubGlobal('window', new Proxy(browserWindow, {
      get(target, property) {
        if (property === 'location') {
          return {pathname: target.location.pathname, replace};
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    }));
    const client = authenticatedClient();
    vi.mocked(client.getSession)
      .mockResolvedValueOnce({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null, permissions: ['bulletin:read']}
      })
      .mockResolvedValueOnce({authenticated: false});
    vi.mocked(client.issueAccessToken).mockResolvedValue({accessToken: 'member-token', expiresIn: 900});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {canRead: true, publicEnabled: false, policyVersion: 1}, meta: {}, error: null
    }), {headers: {'content-type': 'application/json'}}));
    const user = userEvent.setup();

    render(<AccountControl accountSiteUrl="https://account.alive.org.tw" client={client} labels={labels} />);

    await screen.findByRole('button', {name: 'Account menu'});
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await trigger(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/zh-Hant'));
  });

  it.each([
    ['the session is still loading', '/en/literature-ministry', 'loading'],
    ['bulletin access is still loading', '/en/literature-ministry', 'access-loading'],
    ['public access is open', '/en/literature-ministry', 'public'],
    ['the member remains eligible', '/en/literature-ministry', 'eligible'],
    ['the route is unrelated', '/en/literature-ministry/archive', 'unrelated']
  ] as const)('does not replace the route while %s', async (_case, path, state) => {
    window.history.replaceState({}, '', path);
    const browserWindow = window;
    const replace = vi.fn();
    vi.stubGlobal('window', new Proxy(browserWindow, {
      get(target, property) {
        if (property === 'location') {
          return {pathname: target.location.pathname, replace};
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    }));
    const client = state === 'loading'
      ? anonymousClient()
      : state === 'eligible'
        ? authenticatedClient()
        : anonymousClient();
    if (state === 'loading') vi.mocked(client.getSession).mockReturnValue(new Promise(() => {}));
    if (state === 'eligible') {
      vi.mocked(client.getSession).mockResolvedValue({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null, permissions: ['bulletin:read']}
      });
      vi.mocked(client.issueAccessToken).mockResolvedValue({accessToken: 'member-token', expiresIn: 900});
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => state === 'access-loading'
      ? new Promise(() => {})
      : Promise.resolve(new Response(JSON.stringify({data: state === 'public'
        ? {enabled: true}
        : {canRead: true, publicEnabled: false, policyVersion: 1}, meta: {}, error: null
      }), {headers: {'content-type': 'application/json'}})));

    render(<AccountControl accountSiteUrl="https://account.alive.org.tw" client={client} labels={labels} />);

    if (state !== 'loading' && state !== 'access-loading') {
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(replace).not.toHaveBeenCalled();
  });
});

it('uses live member availability instead of the session permission alone', async () => {
 const client=authenticatedClient();
 vi.mocked(client.getSession).mockResolvedValue({authenticated:true,user:{id:'u1',email:'test@example.invalid',display_name:'Test',avatar_url:null,permissions:['bulletin:read']}});
 vi.mocked(client.issueAccessToken).mockResolvedValue({accessToken:'member-token',expiresIn:900});
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({data:{canRead:false,publicEnabled:false,policyVersion:2},meta:{},error:null}),{headers:{'Content-Type':'application/json'}}));
 render(<AccountControlProvider client={client} labels={labels} oauth={oauth}><BulletinAccessGate publicEnabled={false}><span>Member content</span></BulletinAccessGate></AccountControlProvider>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalled());
 expect(screen.queryByText('Member content')).not.toBeInTheDocument();
 fetcher.mockImplementation(async()=>new Response(JSON.stringify({data:{canRead:true,publicEnabled:false,policyVersion:3},meta:{},error:null}),{headers:{'Content-Type':'application/json'}}));
 fireEvent.focus(window);
 expect(await screen.findByText('Member content')).toBeVisible();
});

it('switches download mode when live access supersedes the server snapshot', async () => {
 function Mode(){return <span>{useBulletinMemberMode(false)?'Member download mode':'Public download mode'}</span>;}
 const client=authenticatedClient();
 vi.mocked(client.getSession).mockResolvedValue({authenticated:true,user:{id:'u1',email:'test@example.invalid',display_name:'Test',avatar_url:null,permissions:['bulletin:read']}});
 vi.mocked(client.issueAccessToken).mockResolvedValue({accessToken:'member-token',expiresIn:900});
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({data:{canRead:true,publicEnabled:false,policyVersion:3},meta:{},error:null}),{headers:{'Content-Type':'application/json'}}));
 render(<AccountControlProvider client={client} labels={labels} oauth={oauth}><Mode/></AccountControlProvider>);
 expect(await screen.findByText('Member download mode')).toBeVisible();
});

it('invalidates member A download and eligibility when a focus refresh switches to member B', async () => {
  const bootstrap = await import('@/lib/browser-bootstrap');
  const {DownloadButton} = await import('@/components/ui/DownloadButton');
  const client = authenticatedClient();
  const session = (id: string) => ({authenticated: true as const, user: {id, email: `${id}@example.com`, display_name: id, avatar_url: null, permissions: ['bulletin:read']}});
  vi.mocked(client.getSession).mockResolvedValue(session('A'));
  vi.mocked(client.issueAccessToken).mockResolvedValue({accessToken: 'token', expiresIn: 900});
  vi.spyOn(bootstrap, 'getSharedAccountSessionClient').mockReturnValue(client);
  let finishBlob!: (blob: Blob) => void;
  let finishAccess!: (response: Response) => void;
  let downloadSignal: AbortSignal | undefined;
  let accessReads = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('/member/bulletin-access')) {
      if (++accessReads > 1) return new Promise(resolve => {finishAccess = resolve;});
      return new Response(JSON.stringify({data: {canRead: true, publicEnabled: false}}), {headers: {'content-type': 'application/json'}});
    }
    downloadSignal = init?.signal ?? undefined;
    return {ok: true, blob: () => new Promise<Blob>(resolve => {finishBlob = resolve;})} as Response;
  });
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:old-account');
  render(<AccountControlProvider client={client} labels={labels} oauth={oauth}>
    <BulletinAccessGate publicEnabled={false}><span>Eligible member</span></BulletinAccessGate>
    <DownloadButton href="/api/member/bulletin-downloads/2026-09-13" authenticated label="Download" />
  </AccountControlProvider>);
  await screen.findByText('Eligible member');
  fireEvent.click(screen.getByRole('link', {name: 'Download'}));
  await waitFor(() => expect(finishBlob).toBeDefined());
  vi.mocked(client.getSession).mockResolvedValue(session('B'));
  fireEvent.focus(window);
  await waitFor(() => expect(finishAccess).toBeDefined());
  expect(screen.queryByText('Eligible member')).not.toBeInTheDocument();
  expect(downloadSignal?.aborted).toBe(true);
  await act(async () => finishBlob(new Blob(['A document'])));
  expect(create).not.toHaveBeenCalled();
  await act(async () => finishAccess(new Response(JSON.stringify({data: {canRead: true, publicEnabled: false}}), {headers: {'content-type': 'application/json'}})));
  expect(await screen.findByText('Eligible member')).toBeVisible();
});
