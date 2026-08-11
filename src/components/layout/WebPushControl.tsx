'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Bell, BellOff, LoaderCircle, X} from 'lucide-react';
import {IconButton} from '@hallelujahhomechurch/ui';
import type {Locale} from '@/i18n/locales';
import {isIOSDevice, isStandaloneWebApp} from '@/lib/pwa-capabilities';

const installationKey = 'hhc_push_installation_id';
const promptVisitKey = 'hhc_push_prompt_visits';
const promptSnoozeKey = 'hhc_push_prompt_snooze_until';
const legacyRegistrationSyncKey = 'hhc_push_registration_sync';
const registrationStateKey = 'hhc_push_registration_state';
const registrationLeaseKey = 'hhc_push_registration_lease';
const registrationCooldownKey = 'hhc_push_registration_cooldown';
const accountBindingSyncKey = 'hhc_push_account_binding_sync';
const promptDelay = 8000;
const laterCooldown = 14 * 24 * 60 * 60 * 1000;
const dismissCooldown = 30 * 24 * 60 * 60 * 1000;
const registrationLeaseDuration = 30_000;
const minimumRetryCooldown = 60_000;

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

const pendingSyncs = new Map<string, Promise<boolean>>();
const pendingRegistrations = new Map<string, Promise<boolean>>();

function syncOnce(key: string, value: string, operation: () => Promise<boolean>) {
  if (sessionStorage.getItem(key) === value) return Promise.resolve(true);
  const requestKey = `${key}:${value}`;
  const existing = pendingSyncs.get(requestKey);
  if (existing) return existing;

  const pending = operation().then((success) => {
    if (success) sessionStorage.setItem(key, value);
    return success;
  }).finally(() => pendingSyncs.delete(requestKey));
  pendingSyncs.set(requestKey, pending);
  return pending;
}

function clearPushSyncState() {
  sessionStorage.removeItem(legacyRegistrationSyncKey);
  sessionStorage.removeItem(accountBindingSyncKey);
  localStorage.removeItem(registrationStateKey);
  localStorage.removeItem(registrationLeaseKey);
  localStorage.removeItem(registrationCooldownKey);
}

function storedFingerprint(key: string) {
  const [fingerprint = '', timestamp = ''] = (localStorage.getItem(key) ?? '').split(':');
  const value = Number(timestamp);
  return /^[0-9a-f]{64}$/.test(fingerprint) && Number.isFinite(value) ? {fingerprint, timestamp: value} : null;
}

function storeFingerprint(key: string, fingerprint: string, timestamp: number) {
  localStorage.setItem(key, `${fingerprint}:${Math.floor(timestamp)}`);
}

async function subscriptionFingerprint(subscription: PushSubscription, locale: Locale) {
  const value = subscription.toJSON();
  const input = JSON.stringify([
    locale,
    value.endpoint ?? '',
    value.expirationTime ?? null,
    value.keys?.p256dh ?? '',
    value.keys?.auth ?? ''
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function retryDelay(response: Response) {
  const value = response.headers.get('Retry-After')?.trim() ?? '';
  const seconds = Number(value);
  if (value && Number.isFinite(seconds)) return Math.max(minimumRetryCooldown, seconds * 1000);
  const date = Date.parse(value);
  return Math.max(minimumRetryCooldown, Number.isFinite(date) ? date - Date.now() : 0);
}

async function bindInstallationToAccount() {
  try {
    const session = await fetch('/api/account/v1/session', {
      credentials: 'include',
      headers: {Accept: 'application/json'},
      cache: 'no-store'
    });
    if (!session.ok) return false;
    const payload = await session.json() as {authenticated?: boolean; user?: {id?: string}};
    if (!payload.authenticated) {
      sessionStorage.removeItem(accountBindingSyncKey);
      return true;
    }
    if (!payload.user?.id) return false;

    const installation = installationId();
    return syncOnce(accountBindingSyncKey, `${installation}:${payload.user.id}`, async () => {
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
        body: JSON.stringify({installation_id: installation})
      });
      return response.ok;
    });
  } catch {
    return false;
  }
}

async function registerSubscription(subscription: PushSubscription, locale: Locale) {
  try {
    const fingerprint = await subscriptionFingerprint(subscription, locale);
    if (storedFingerprint(registrationStateKey)?.fingerprint === fingerprint) return true;

    const cooldown = storedFingerprint(registrationCooldownKey);
    if (cooldown?.fingerprint === fingerprint && cooldown.timestamp > Date.now()) return false;

    const existing = pendingRegistrations.get(fingerprint);
    if (existing) return existing;

    const lease = storedFingerprint(registrationLeaseKey);
    if (lease?.fingerprint === fingerprint && lease.timestamp > Date.now()) return false;
    storeFingerprint(registrationLeaseKey, fingerprint, Date.now() + registrationLeaseDuration);

    const installation = installationId();
    const pending = (async () => {
      const response = await fetch('/api/engagement/v1/push/subscriptions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({installationId: installation, locale, subscription: subscription.toJSON()})
      });
      if (response.status === 429) {
        storeFingerprint(registrationCooldownKey, fingerprint, Date.now() + retryDelay(response));
        return false;
      }
      if (!response.ok) return false;
      storeFingerprint(registrationStateKey, fingerprint, Date.now());
      localStorage.removeItem(registrationCooldownKey);
      return true;
    })().finally(() => {
      pendingRegistrations.delete(fingerprint);
      if (storedFingerprint(registrationLeaseKey)?.fingerprint === fingerprint) {
        localStorage.removeItem(registrationLeaseKey);
      }
    });
    pendingRegistrations.set(fingerprint, pending);
    return pending;
  } catch {
    return false;
  }
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
          void Promise.all([
            registerSubscription(subscription, locale),
            bindInstallationToAccount()
          ]).then(([registered, bound]) => {
            if (active) setBindingPending(!registered || !bound);
          });
        } else clearPushSyncState();
        if (active) setState(Notification.permission === 'denied' ? 'denied' : subscription ? 'on' : 'off');
      } catch {
        if (active) setState('error');
      }
    });

    return () => {
      active = false;
    };
  }, [locale]);

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
      void registration.current?.pushManager.getSubscription().then(async (subscription) => {
        if (!subscription) {
          setBindingPending(false);
          return;
        }
        const [registered, bound] = await Promise.all([
          registerSubscription(subscription, locale),
          bindInstallationToAccount()
        ]);
        setBindingPending(!registered || !bound);
      });
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [bindingPending, locale, state]);

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
        clearPushSyncState();
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
      if (!await registerSubscription(subscription, locale)) {
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
      <IconButton
        type="button"
        aria-label={label}
        data-account-binding={bindingPending ? 'retrying' : undefined}
        isDisabled={pending}
        onPress={() => void updateSubscription()}
        variant="soft"
        size="lg"
        icon={pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : state === 'on' ? <BellOff className="size-5" aria-hidden="true" /> : <Bell className="size-5" aria-hidden="true" />}
      />
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
