import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resetBrowserBootstrap} from '@/lib/browser-bootstrap';
import {WebPushControl} from './WebPushControl';

const labels = {
  enable: 'Enable notifications',
  disable: 'Disable notifications',
  pending: 'Updating notifications',
  denied: 'Notifications are blocked in your browser',
  error: 'Unable to update notifications. Try again.',
  promptTitle: 'Stay informed',
  promptBody: 'Receive important church updates on this device.',
  promptAction: 'Enable notifications',
  promptLater: 'Later',
  installPrompt: 'Add this website to your Home Screen to enable notifications.'
};

function pushSubscription(endpoint = 'https://push.example.test/existing', auth = 'existing-auth') {
  return {
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: {p256dh: 'existing-p256dh', auth}
    })
  };
}

describe('WebPushControl', () => {
  const requestPermission = vi.fn();
  const subscribe = vi.fn();
  const getSubscription = vi.fn();
  const registration = {pushManager: {getSubscription, subscribe}};

  beforeEach(() => {
    resetBrowserBootstrap();
    localStorage.clear();
    sessionStorage.clear();
    requestPermission.mockReset().mockResolvedValue('granted');
    getSubscription.mockReset().mockResolvedValue(null);
    subscribe.mockReset().mockResolvedValue({
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
    vi.useRealTimers();
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
    const existingSubscription = {
      unsubscribe: vi.fn(),
      toJSON: () => ({
        endpoint: 'https://push.example.test/existing',
        expirationTime: null,
        keys: {p256dh: 'existing-p256dh', auth: 'existing-auth'}
      })
    };
    getSubscription.mockResolvedValue(existingSubscription);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/push/config')) {
        return new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200});
      }
      if (url.endsWith('/session')) {
        return Response.json({authenticated: true, user: {id: 'private-user-id', email: 'user@example.test', display_name: 'User', avatar_url: null, admin_access: false}});
      }
      if (url.endsWith('/csrf-token')) {
        return new Response(JSON.stringify({csrf_token: 'csrf-value'}), {status: 200});
      }
      if (url.endsWith('/push-subscriptions/bind') && init?.method === 'POST') {
        return new Response(null, {status: 204});
      }
      if (url.endsWith('/push/subscriptions') && init?.method === 'POST') {
        return new Response(JSON.stringify({data: {status: 'active'}}), {status: 200});
      }
      return new Response(null, {status: 404});
    }));

    render(<WebPushControl locale="en" labels={labels} />);

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toBe(true));
    const refreshCall = vi.mocked(fetch).mock.calls.find(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    );
    expect(JSON.parse(String(refreshCall?.[1]?.body))).toEqual({
      installationId: expect.any(String),
      locale: 'en',
      subscription: existingSubscription.toJSON()
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/account/v1/push-subscriptions/bind',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({'x-csrf-token': 'csrf-value'}),
        body: expect.stringContaining('installation_id')
      })
    ));
    const bindCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/push-subscriptions/bind'));
    expect(bindCall?.[1]?.body).not.toContain('private-user-id');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('does not repeat successful subscription writes when remounted', async () => {
    const existingSubscription = pushSubscription();
    getSubscription.mockResolvedValue(existingSubscription);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/push/config')) return new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200});
      if (url.endsWith('/session')) return Response.json({authenticated: true, user: {id: 'user-id', email: 'user@example.test', display_name: 'User', avatar_url: null, admin_access: false}});
      if (url.endsWith('/csrf-token')) return new Response(JSON.stringify({csrf_token: 'csrf-value'}), {status: 200});
      if (url.endsWith('/push-subscriptions/bind') && init?.method === 'POST') return new Response(null, {status: 204});
      if (url.endsWith('/push/subscriptions') && init?.method === 'POST') return new Response(JSON.stringify({data: {status: 'active'}}), {status: 201});
      return new Response(null, {status: 404});
    }));

    const first = render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url).endsWith('/push-subscriptions/bind')
    )).toHaveLength(1));
    first.unmount();
    render(<WebPushControl locale="en" labels={labels} />);

    await waitFor(() => expect(screen.getByRole('button', {name: labels.disable})).toBeInTheDocument());
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url).endsWith('/push-subscriptions/bind')
    )).toHaveLength(1);
  });

  it('keeps an in-flight subscription write single across remounts', async () => {
    getSubscription.mockResolvedValue(pushSubscription());
    let finishRegistration!: (response: Response) => void;
    const registrationResponse = new Promise<Response>((resolve) => { finishRegistration = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/push/config')) return new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200});
      if (url.endsWith('/push/subscriptions') && init?.method === 'POST') return registrationResponse;
      return new Response(null, {status: 404});
    }));

    const first = render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1));
    first.unmount();
    render(<WebPushControl locale="en" labels={labels} />);

    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1);
    finishRegistration(new Response(null, {status: 201}));
    expect(await screen.findByRole('button', {name: labels.disable})).toBeInTheDocument();
  });

  it('persists only a digest so a reload-like remount does not rewrite the same subscription', async () => {
    getSubscription.mockResolvedValue(pushSubscription());
    const first = render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1));

    first.unmount();
    sessionStorage.clear();
    render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(screen.getByRole('button', {name: labels.disable})).toBeInTheDocument());

    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1);
    const stored = localStorage.getItem('hhc_push_registration_state') ?? '';
    expect(stored).toMatch(/^[0-9a-f]{64}:\d+$/);
    expect(stored).not.toContain('push.example.test');
    expect(stored).not.toContain('existing-p256dh');
    expect(stored).not.toContain('existing-auth');
  });

  it('writes once for a real locale change', async () => {
    getSubscription.mockResolvedValue(pushSubscription());
    const first = render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1));
    first.unmount();
    render(<WebPushControl locale="ja" labels={labels} />);

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(2));
  });

  it('writes once when the browser rotates the subscription', async () => {
    getSubscription.mockResolvedValue(pushSubscription());
    const first = render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1));
    first.unmount();
    getSubscription.mockResolvedValue(pushSubscription('https://push.example.test/rotated', 'rotated-auth'));
    render(<WebPushControl locale="en" labels={labels} />);

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(2));
  });

  it('honors Retry-After and suppresses navigation retries after a 429', async () => {
    getSubscription.mockResolvedValue(pushSubscription());
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/push/config')) return new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200});
      if (url.endsWith('/push/subscriptions') && init?.method === 'POST') {
        return new Response(null, {status: 429, headers: {'Retry-After': '120'}});
      }
      return new Response(null, {status: 404});
    }));

    const first = render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1));
    first.unmount();
    sessionStorage.clear();
    render(<WebPushControl locale="en" labels={labels} />);
    await waitFor(() => expect(screen.getByRole('button', {name: labels.disable})).toBeInTheDocument());

    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith('/push/subscriptions') && init?.method === 'POST'
    )).toHaveLength(1);
    const cooldown = localStorage.getItem('hhc_push_registration_cooldown') ?? '';
    expect(cooldown).toMatch(/^[0-9a-f]{64}:\d+$/);
    expect(Number(cooldown.split(':')[1])).toBeGreaterThanOrEqual(Date.now() + 120_000 - 1000);
  });

  it('treats denied browser permission as blocked even when a stale subscription exists', async () => {
    getSubscription.mockResolvedValue({
      unsubscribe: vi.fn(),
      toJSON: () => ({endpoint: 'https://push.example.test/stale', keys: {p256dh: 'stale', auth: 'stale'}})
    });
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: {permission: 'denied', requestPermission}
    });

    render(<WebPushControl locale="en" labels={labels} />);

    expect(await screen.findByRole('button', {name: labels.denied})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: labels.disable})).not.toBeInTheDocument();
  });

  it('shows a first-party prompt only on a later homepage visit', async () => {
    vi.useFakeTimers();
    localStorage.setItem('hhc_push_prompt_visits', '1');

    render(<WebPushControl locale="en" labels={labels} autoPrompt />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('button', {name: labels.enable})).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(8000));

    expect(screen.getByRole('dialog', {name: labels.promptTitle})).toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
