'use client';

import {
  analyticsMessages,
  createAnalyticsController,
  getAnalyticsChoiceCookie,
  readAnalyticsChoice,
  type AnalyticsChoice,
} from '@hallelujahhomechurch/preferences';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Locale } from '@/i18n/locales';
import { publicAnalyticsRoute } from '@/lib/analytics-route';

export function AnalyticsBoundary({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';
  const enabled =
    /^G-[A-Z0-9]{5,20}$/.test(id) &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'www.alive.org.tw';
  const route =
    pathname && search
      ? publicAnalyticsRoute(
          pathname,
          search.toString(),
          typeof window === 'undefined' ? '' : window.location.hash,
        )
      : null;
  const controller = useRef<ReturnType<
    typeof createAnalyticsController
  > | null>(null);
  const [started, setStarted] = useState(false);
  const [choice, setChoice] = useState<AnalyticsChoice>('unknown');
  useLayoutEffect(() => {
    if (!enabled) return;
    const value = createAnalyticsController({
      measurementId: id,
      host: window.location.hostname,
      readChoice: () => readAnalyticsChoice(document.cookie),
    });
    controller.current = value;
    return () => {
      value.dispose();
      controller.current = null;
    };
  }, [enabled, id]);
  useLayoutEffect(() => {
    if (!controller.current) return;
    const reload = !route && controller.current.requiresDocumentNavigation();
    controller.current.sync(route);
    // Mirror the external script lifecycle before a later route can mount private UI.
    setStarted(controller.current.requiresDocumentNavigation());
    if (reload)
      window.location.replace(
        `${pathname}${window.location.search}${window.location.hash}`,
      );
  }, [route, pathname]);
  useEffect(() => {
    if (!enabled) return;
    const sync = () => {
      setChoice(readAnalyticsChoice(document.cookie));
      const next = publicAnalyticsRoute(
        window.location.pathname,
        window.location.search,
        window.location.hash,
      );
      const reload = !next && controller.current?.requiresDocumentNavigation();
      controller.current?.sync(next);
      setStarted(controller.current?.requiresDocumentNavigation() ?? false);
      if (reload) window.location.reload();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('hhc:analytics-choice', sync);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('hhc:analytics-choice', sync);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled]);
  function choose(next: Exclude<AnalyticsChoice, 'unknown'>) {
    document.cookie = getAnalyticsChoiceCookie(next);
    setChoice(next);
    controller.current?.sync(route);
    setStarted(controller.current?.requiresDocumentNavigation() ?? false);
    window.dispatchEvent(new Event('hhc:analytics-choice'));
  }
  if (enabled && !route && started) return null;
  const copy = analyticsMessages[locale];
  return (
    <>
      {children}
      {enabled ? (
        <details
          className="analytics-preferences"
          key={choice === 'unknown' ? 'unknown' : 'chosen'}
          open={choice === 'unknown' ? true : undefined}
        >
          <summary>{copy.title}</summary>
          <p>{copy.description}</p>
          <button type="button" onClick={() => choose('granted')}>
            {copy.allow}
          </button>{' '}
          <button type="button" onClick={() => choose('denied')}>
            {copy.deny}
          </button>
        </details>
      ) : null}
    </>
  );
}
