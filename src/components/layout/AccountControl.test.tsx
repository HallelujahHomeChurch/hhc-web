import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {AccountControl, accountStateEventName} from './AccountControl';

const labels = {
  menu: 'Account menu',
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
    logout: vi.fn(),
    logoutAll: vi.fn()
  };
}

function authenticatedClient(logoutAll = vi.fn().mockResolvedValue(undefined)): AccountSessionClient {
  return {
    getSession: vi.fn().mockResolvedValue({
      authenticated: true,
      user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null}
    }),
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

  it('keeps the account menu visible when global sign out fails', async () => {
    const user = userEvent.setup();
    const logoutAll = vi.fn().mockRejectedValue(new Error('unavailable'));

    render(
      <AccountControl
        accountSiteUrl="https://account.alive.org.tw"
        client={authenticatedClient(logoutAll)}
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
        client={authenticatedClient(logoutAll)}
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
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null}
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

  it('revalidates when another same-origin account control reports sign out', async () => {
    const client = authenticatedClient();
    vi.mocked(client.getSession)
      .mockResolvedValueOnce({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null}
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
});
