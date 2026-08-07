'use client';

import {useEffect, useRef, useState} from 'react';
import {Bell, BellOff, LoaderCircle} from 'lucide-react';
import type {Locale} from '@/i18n/locales';

const installationKey = 'hhc_push_installation_id';

type Labels = {
  enable: string;
  disable: string;
  pending: string;
  denied: string;
  error: string;
};

type WebPushControlProps = {
  labels: Labels;
  locale: Locale;
};

type State = 'checking' | 'off' | 'on' | 'pending' | 'denied' | 'error' | 'unsupported';

function applicationServerKey(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function installationId() {
  const existing = localStorage.getItem(installationKey);
  if (existing) return existing;
  const value = crypto.randomUUID();
  localStorage.setItem(installationKey, value);
  return value;
}

async function bindInstallationToAccount() {
  try {
    const session = await fetch('/api/account/v1/session', {
      credentials: 'include',
      headers: {Accept: 'application/json'},
      cache: 'no-store'
    });
    if (!session.ok || !(await session.json() as {authenticated?: boolean}).authenticated) return;

    const csrf = await fetch('/api/account/v1/csrf-token', {
      credentials: 'include',
      headers: {Accept: 'application/json'},
      cache: 'no-store'
    });
    if (!csrf.ok) return;
    const {csrf_token: csrfToken} = await csrf.json() as {csrf_token?: string};
    if (!csrfToken) return;

    await fetch('/api/account/v1/push-subscriptions/bind', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json', 'x-csrf-token': csrfToken},
      body: JSON.stringify({installation_id: installationId()})
    });
  } catch {
    // General broadcast subscriptions remain valid when account association is unavailable.
  }
}

export function WebPushControl({labels, locale}: WebPushControlProps) {
  const [state, setState] = useState<State>('checking');
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const vapidPublicKey = useRef('');

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in globalThis) || !('Notification' in globalThis)) {
        if (active) setState('unsupported');
        return;
      }
      try {
        const [serviceWorker, response] = await Promise.all([
          navigator.serviceWorker.register('/sw.js'),
          fetch('/api/engagement/v1/push/config', {headers: {Accept: 'application/json'}})
        ]);
        if (!response.ok) throw new Error('push config unavailable');
        const payload = await response.json() as {data?: {vapidPublicKey?: string}};
        if (!payload.data?.vapidPublicKey) throw new Error('push config invalid');
        registration.current = serviceWorker;
        vapidPublicKey.current = payload.data.vapidPublicKey;
        const subscription = await serviceWorker.pushManager.getSubscription();
        if (subscription) void bindInstallationToAccount();
        if (active) setState(subscription ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
      } catch {
        if (active) setState('error');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (state === 'unsupported') return null;

  const pending = state === 'checking' || state === 'pending';
  const label = pending ? labels.pending : state === 'on' ? labels.disable : state === 'denied' ? labels.denied : state === 'error' ? labels.error : labels.enable;

  async function updateSubscription() {
    const serviceWorker = registration.current;
    if (!serviceWorker || !vapidPublicKey.current || pending) return;
    setState('pending');

    try {
      const current = await serviceWorker.pushManager.getSubscription();
      if (current) {
        const response = await fetch('/api/engagement/v1/push/subscriptions', {
          method: 'DELETE',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({installationId: installationId()})
        });
        if (!response.ok || !(await current.unsubscribe())) throw new Error('unsubscribe failed');
        setState('off');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const subscription = await serviceWorker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(vapidPublicKey.current)
      });
      const response = await fetch('/api/engagement/v1/push/subscriptions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({installationId: installationId(), locale, subscription: subscription.toJSON()})
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error('subscription registration failed');
      }
      void bindInstallationToAccount();
      setState('on');
    } catch {
      setState('error');
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending || state === 'denied'}
      onClick={updateSubscription}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-transparent bg-primary-soft px-4 font-semibold text-primary transition hover:bg-primary-soft-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : state === 'on' ? <BellOff className="size-5" aria-hidden="true" /> : <Bell className="size-5" aria-hidden="true" />}
      <span className="max-[620px]:sr-only">{label}</span>
    </button>
  );
}
