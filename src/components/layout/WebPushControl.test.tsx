import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {WebPushControl} from './WebPushControl';

const labels = {
  enable: 'Enable notifications',
  disable: 'Disable notifications',
  pending: 'Updating notifications',
  denied: 'Notifications are blocked in your browser',
  error: 'Unable to update notifications. Try again.'
};

describe('WebPushControl', () => {
  const requestPermission = vi.fn();
  const subscribe = vi.fn();
  const getSubscription = vi.fn();
  const registration = {pushManager: {getSubscription, subscribe}};

  beforeEach(() => {
    localStorage.clear();
    requestPermission.mockResolvedValue('granted');
    getSubscription.mockResolvedValue(null);
    subscribe.mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.example.test/subscription',
        expirationTime: null,
        keys: {p256dh: 'p256dh', auth: 'auth'}
      }),
      unsubscribe: vi.fn().mockResolvedValue(true)
    });

    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: {permission: 'default', requestPermission}
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {register: vi.fn().mockResolvedValue(registration)}
    });
    Object.defineProperty(globalThis, 'PushManager', {configurable: true, value: class {}});
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/push/config')) {
        return new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200});
      }
      if (url.endsWith('/push/subscriptions') && init?.method === 'POST') {
        return new Response(JSON.stringify({data: {status: 'active'}}), {status: 201});
      }
      return new Response(null, {status: 404});
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for permission and subscribes only after an explicit click', async () => {
    const user = userEvent.setup();
    render(<WebPushControl locale="en" labels={labels} />);

    const button = await screen.findByRole('button', {name: labels.enable});
    expect(requestPermission).not.toHaveBeenCalled();

    await user.click(button);

    await waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3])
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/engagement/v1/push/subscriptions',
      expect.objectContaining({method: 'POST'})
    );
    expect(screen.getByRole('button', {name: labels.disable})).toBeInTheDocument();
  });

  it('binds an existing subscription to the authenticated account without exposing a user id', async () => {
    getSubscription.mockResolvedValue({unsubscribe: vi.fn()});
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/push/config')) {
        return new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200});
      }
      if (url.endsWith('/session')) {
        return new Response(JSON.stringify({authenticated: true, user: {id: 'private-user-id'}}), {status: 200});
      }
      if (url.endsWith('/csrf-token')) {
        return new Response(JSON.stringify({csrf_token: 'csrf-value'}), {status: 200});
      }
      if (url.endsWith('/push-subscriptions/bind') && init?.method === 'POST') {
        return new Response(null, {status: 204});
      }
      return new Response(null, {status: 404});
    }));

    render(<WebPushControl locale="en" labels={labels} />);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/account/v1/push-subscriptions/bind',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({'x-csrf-token': 'csrf-value'}),
        body: expect.stringContaining('installationId')
      })
    ));
    const bindCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/push-subscriptions/bind'));
    expect(bindCall?.[1]?.body).not.toContain('private-user-id');
  });
});
