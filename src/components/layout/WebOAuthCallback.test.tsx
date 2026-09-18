import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WebOAuthCallback} from './WebOAuthCallback';

beforeEach(() => {
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
});
