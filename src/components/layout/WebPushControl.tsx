'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Bell, BellOff, LoaderCircle, X} from 'lucide-react';
import type {Locale} from '@/i18n/locales';

const installationKey = 'hhc_push_installation_id';
const promptVisitKey = 'hhc_push_prompt_visits';
const promptSnoozeKey = 'hhc_push_prompt_snooze_until';
const promptDelay = 8000;
const laterCooldown = 14 * 24 * 60 * 60 * 1000;
const dismissCooldown = 30 * 24 * 60 * 60 * 1000;

type Labels = {
  enable: string;
  disable: string;
  pending: string;
  denied: string;
  error: string;
  promptTitle: string;
  promptBody: string;
  promptAction: string;
  promptLater: string;
  promptDismiss: string;
  installPrompt: string;
};

type WebPushControlProps = {
  labels: Labels;
  locale: Locale;
  autoPrompt?: boolean;
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
    if (!session.ok) return false;
    if (!(await session.json() as {authenticated?: boolean}).authenticated) return true;

    const csrf = await fetch('/api/account/v1/csrf-token', {
      credentials: 'include',
      headers: {Accept: 'application/json'},
      cache: 'no-store'
    });
    if (!csrf.ok) return false;
    const {csrf_token: csrfToken} = await csrf.json() as {csrf_token?: string};
    if (!csrfToken) return false;

    const response = await fetch('/api/account/v1/push-subscriptions/bind', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json', 'x-csrf-token': csrfToken},
      body: JSON.stringify({installation_id: installationId()})
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isStandaloneWebApp() {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & {standalone?: boolean}).standalone === true;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function WebPushControl({labels, locale, autoPrompt = false}: WebPushControlProps) {
  const [state, setState] = useState<State>('checking');
  const [showPrompt, setShowPrompt] = useState(false);
  const [bindingPending, setBindingPending] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const vapidPublicKey = useRef('');
  const promptTitleId = useId();

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
        if (subscription) {
          void bindInstallationToAccount().then((bound) => {
            if (active) setBindingPending(!bound);
          });
        }
        if (active) setState(Notification.permission === 'denied' ? 'denied' : subscription ? 'on' : 'off');
      } catch {
        if (active) setState('error');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoPrompt || state !== 'off' || Notification.permission !== 'default') return;
    const visits = Number.parseInt(localStorage.getItem(promptVisitKey) ?? '0', 10) || 0;
    localStorage.setItem(promptVisitKey, String(visits + 1));
    const snoozeUntil = Number.parseInt(localStorage.getItem(promptSnoozeKey) ?? '0', 10) || 0;
    if (visits < 1 || snoozeUntil > Date.now()) return;
    const timer = window.setTimeout(() => setShowPrompt(true), promptDelay);
    return () => window.clearTimeout(timer);
  }, [autoPrompt, state]);

  useEffect(() => {
    if (!bindingPending || state !== 'on') return;
    const timer = window.setTimeout(() => {
      void bindInstallationToAccount().then((bound) => setBindingPending(!bound));
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [bindingPending, state]);

  if (state === 'unsupported') return null;

  const pending = state === 'checking' || state === 'pending';
  const label = pending ? labels.pending : state === 'on' ? labels.disable : state === 'denied' ? labels.denied : state === 'error' ? labels.error : labels.enable;

  async function updateSubscription() {
    const serviceWorker = registration.current;
    if (!serviceWorker || !vapidPublicKey.current || pending) return;
    if (state === 'denied') {
      setShowPrompt(true);
      return;
    }
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
        setShowPrompt(false);
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
      const bound = await bindInstallationToAccount();
      setBindingPending(!bound);
      setState('on');
      setShowPrompt(false);
    } catch {
      setState('error');
    }
  }

  function deferPrompt(duration: number) {
    localStorage.setItem(promptSnoozeKey, String(Date.now() + duration));
    setShowPrompt(false);
  }

  const standalone = typeof window !== 'undefined' && isStandaloneWebApp();
  const requiresInstall = typeof window !== 'undefined' && isIOSDevice() && !standalone;
  const promptBody = state === 'denied' ? labels.denied : requiresInstall ? labels.installPrompt : labels.promptBody;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        data-account-binding={bindingPending ? 'retrying' : undefined}
        disabled={pending}
        onClick={updateSubscription}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-transparent bg-primary-soft p-0 text-primary transition hover:bg-primary-soft-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : state === 'on' ? <BellOff className="size-5" aria-hidden="true" /> : <Bell className="size-5" aria-hidden="true" />}
      </button>
      {showPrompt ? (
        <section
          role="dialog"
          aria-labelledby={promptTitleId}
          className="fixed bottom-5 right-5 z-50 grid w-[min(360px,calc(100vw-32px))] gap-4 rounded-lg border border-line bg-paper p-5 shadow-xl max-[620px]:bottom-24 max-[620px]:left-4 max-[620px]:right-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <h2 id={promptTitleId} className="text-base font-bold text-ink">{labels.promptTitle}</h2>
              <p className="text-sm leading-6 text-muted">{promptBody}</p>
            </div>
            <button
              type="button"
              aria-label={labels.promptDismiss}
              onClick={() => deferPrompt(dismissCooldown)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-primary-soft hover:text-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => deferPrompt(laterCooldown)} className="min-h-10 px-3 font-semibold text-muted hover:text-primary">
              {labels.promptLater}
            </button>
            {state !== 'denied' && !requiresInstall ? (
              <button type="button" onClick={updateSubscription} className="min-h-10 rounded-full bg-primary-solid px-4 font-semibold text-primary-foreground hover:bg-primary-solid-hover">
                {labels.promptAction}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
