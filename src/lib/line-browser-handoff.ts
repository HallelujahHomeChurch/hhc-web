import {isLocale} from '@/i18n/locales';

const targetKey = 'hhc:line-browser:video-target';
let target: string | null | undefined;

export const isLineBrowser = (userAgent: string) => /\bLINE\/\d/i.test(userAgent);

function videoLocale(url: URL) {
  const match = url.pathname.match(/^\/([^/]+)\/member-videos(?:\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})?\/?$/);
  return match && isLocale(match[1]) ? match[1] : null;
}

export function rememberLineVideoTarget() {
  if (!isLineBrowser(navigator.userAgent) || !videoLocale(new URL(window.location.href))) return;
  target = window.location.href;
  try { sessionStorage.setItem(targetKey, target); } catch { /* Keep the in-memory target when storage is unavailable. */ }
}

export function clearLineVideoTarget() {
  target = null;
  try { sessionStorage.removeItem(targetKey); } catch { /* The in-memory target is already cleared. */ }
}

export function lineBrowserTarget(rawUrl: string): string {
  const current = new URL(rawUrl);
  if (target === undefined) {
    try { target = sessionStorage.getItem(targetKey); } catch { target = null; }
  }
  if (target) {
    try {
      const saved = new URL(target);
      const locale = videoLocale(saved);
      if (locale && saved.origin === current.origin && !saved.username && !saved.password) {
        if (current.pathname.replace(/\/$/, '') === `/${locale}`) return saved.href;
        // The header can update before the pending home redirect commits.
        if (current.href === saved.href) return current.href;
      }
    } catch { /* Ignore malformed stored URLs. */ }
    clearLineVideoTarget();
  }
  return current.href;
}
