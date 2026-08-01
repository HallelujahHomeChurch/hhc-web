import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {OAuthTransaction} from '@hallelujahhomechurch/account-client';
import {WebOAuthCallback} from './WebOAuthCallback';

const transaction: OAuthTransaction = {
  state: 'state-123',
  codeVerifier: 'verifier-123',
  codeChallenge: 'challenge-123',
  returnTo: '/zh-Hant/about?source=header#account',
  createdAt: Date.now()
};

describe('WebOAuthCallback', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('hhc_web_oauth_transaction', JSON.stringify(transaction));
  });

  it('exchanges the code and restores the localized return URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token: 'access'}), {
      status: 200,
      headers: {'content-type': 'application/json'}
    }));
    const navigate = vi.fn();

    render(
      <WebOAuthCallback
        currentUrl={new URL('https://www.alive.org.tw/oauth/callback?code=code-123&state=state-123')}
        fetcher={fetcher}
        navigate={navigate}
        storage={sessionStorage}
      />
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(transaction.returnTo));
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/account/v1/oauth/token');
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(String(init.body)).toContain('code_verifier=verifier-123');
    expect(init.credentials).toBe('include');
    expect(sessionStorage.getItem('hhc_web_oauth_transaction')).toBeNull();
  });

  it('returns to public content without exchanging or looping on login_required', async () => {
    const fetcher = vi.fn();
    const navigate = vi.fn();

    render(
      <WebOAuthCallback
        currentUrl={new URL('https://www.alive.org.tw/oauth/callback?error=login_required&state=state-123')}
        fetcher={fetcher}
        navigate={navigate}
        storage={sessionStorage}
      />
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(transaction.returnTo));
    expect(fetcher).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('hhc_web_oauth_transaction')).toBeNull();
  });

  it('restarts authorization once when callback state does not match', async () => {
    const fetcher = vi.fn();
    const navigate = vi.fn();

    render(
      <WebOAuthCallback
        currentUrl={new URL('https://www.alive.org.tw/oauth/callback?code=code-123&state=wrong')}
        fetcher={fetcher}
        navigate={navigate}
        oauth={{
          authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
          clientId: 'www-web',
          redirectUri: 'https://www.alive.org.tw/oauth/callback',
          scope: 'openid profile email'
        }}
        storage={sessionStorage}
      />
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(new URL(navigate.mock.calls[0][0]).searchParams.get('state')).toBe(transaction.state);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a repeated callback state mismatch', async () => {
    sessionStorage.setItem('hhc_web_oauth_transaction:recovery', '1');
    const fetcher = vi.fn();

    render(
      <WebOAuthCallback
        currentUrl={new URL('https://www.alive.org.tw/oauth/callback?code=code-123&state=wrong')}
        fetcher={fetcher}
        navigate={vi.fn()}
        storage={sessionStorage}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('無法完成登入。');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps a failed token exchange recoverable and retries it', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, {status: 503}))
      .mockResolvedValueOnce(new Response(JSON.stringify({authenticated: false}), {
        status: 200,
        headers: {'content-type': 'application/json'}
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({access_token: 'access'}), {
        status: 200,
        headers: {'content-type': 'application/json'}
      }));
    const navigate = vi.fn();

    render(
      <WebOAuthCallback
        currentUrl={new URL('https://www.alive.org.tw/oauth/callback?code=code-123&state=state-123')}
        fetcher={fetcher}
        navigate={navigate}
        storage={sessionStorage}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('無法完成登入。');
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('hhc_web_oauth_transaction')).not.toBeNull();

    await user.click(screen.getByRole('button', {name: '再試一次'}));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(transaction.returnTo));
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe('/api/account/v1/session');
    expect(sessionStorage.getItem('hhc_web_oauth_transaction')).toBeNull();
  });
});
