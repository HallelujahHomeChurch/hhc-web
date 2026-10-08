import * as Sentry from '@sentry/nextjs';
import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WebOAuthCallback} from './WebOAuthCallback';
import {webPassiveSsoAttemptKey} from './AccountControl';

vi.mock('@sentry/nextjs', () => ({captureException: vi.fn()}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  sessionStorage.setItem('hhc:oauth:www-web', JSON.stringify({
    state: 'state-123', codeVerifier: 'verifier-123', codeChallenge: 'challenge-123', returnTo: '/zh-Hant/about', createdAt: Date.now()
  }));
});

describe('WebOAuthCallback', () => {
  it('delegates code exchange to the shared browser runtime and restores the transaction return URL', async () => {
    const completeSignIn = vi.fn().mockResolvedValue({status: 'authenticated'});
    const navigate = vi.fn();
    render(<WebOAuthCallback currentUrl={new URL('https://www.alive.org.tw/oauth/callback?code=code-123&state=state-123')} runtime={{completeSignIn}} navigate={navigate} />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/zh-Hant/about'));
    expect(completeSignIn).toHaveBeenCalledWith('https://www.alive.org.tw/oauth/callback?code=code-123&state=state-123');
  });

  it('does not redirect when the shared runtime rejects a callback', async () => {
    const navigate = vi.fn();
    render(<WebOAuthCallback runtime={{completeSignIn: vi.fn().mockRejectedValue(new Error('invalid callback'))}} navigate={navigate} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('無法完成登入。');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports malformed session revalidation after a successful token exchange', async () => {
    const fetcher = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/oauth/token')) return Response.json({access_token: 'token', token_type: 'Bearer', expires_in: 300});
      return Response.json({private_body: 'must not be captured'}, {headers: {'x-hhc-request-id': 'callback-session-1'}});
    });
    vi.stubGlobal('fetch', fetcher);
    const navigate = vi.fn();
    render(<WebOAuthCallback currentUrl={new URL('http://localhost:3000/oauth/callback?code=code-123&state=state-123')} navigate={navigate} />);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/session'))).toBe(true);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({tags: expect.objectContaining({api_failure: 'invalid_response'})}));
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('must not be captured');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns silently after prompt=none reports no central session', async () => {
    sessionStorage.setItem(webPassiveSsoAttemptKey, '1');
    const completeSignIn = vi.fn();
    const navigate = vi.fn();

    render(<WebOAuthCallback currentUrl={new URL('https://www.alive.org.tw/oauth/callback?error=login_required&state=state-123')} runtime={{completeSignIn}} navigate={navigate} />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/zh-Hant/about'));
    expect(completeSignIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('hhc:oauth:www-web')).toBeNull();
  });
});
