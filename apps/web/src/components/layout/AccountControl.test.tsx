import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hhc/account-client';
import {AccountControl} from './AccountControl';

const labels = {
  menu: 'Account menu',
  manageAccount: 'Manage account',
  signIn: 'Sign in',
  signOut: 'Sign out'
};

describe('AccountControl', () => {
  it('renders the sign-in destination for an anonymous browser session', async () => {
    const client: AccountSessionClient = {
      getSession: vi.fn().mockResolvedValue({authenticated: false}),
      logout: vi.fn()
    };
    render(<AccountControl accountSiteUrl="https://account.alive.org.tw" client={client} labels={labels} />);

    expect(await screen.findByRole('link', {name: 'Sign in'})).toHaveAttribute(
      'href',
      'https://account.alive.org.tw/login'
    );
  });

  it('shows the shared account menu and signs out through the session client', async () => {
    const user = userEvent.setup();
    const client: AccountSessionClient = {
      getSession: vi.fn().mockResolvedValue({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null}
      }),
      logout: vi.fn().mockResolvedValue(undefined)
    };
    render(<AccountControl accountSiteUrl="https://account.alive.org.tw" client={client} labels={labels} />);

    await user.click(await screen.findByRole('button', {name: 'Account menu'}));
    expect(screen.getByText('Hi Ada')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Manage account'})).toHaveAttribute(
      'href',
      'https://account.alive.org.tw/profile'
    );
    await user.click(screen.getByRole('menuitem', {name: 'Sign out'}));

    expect(client.logout).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('link', {name: 'Sign in'})).toBeInTheDocument());
  });
});
