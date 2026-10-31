'use client';

import * as Sentry from '@sentry/nextjs';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useEffect} from 'react';

// Localized boundary for locale routes, so a failed render keeps the visitor's
// language instead of falling through to the root (zh-Hant only) global error.
export default function LocaleError({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const t = useTranslations('site');
  const locale = useLocale();

  useEffect(() => {
    // Server render failures carry a digest and are already reported by onRequestError.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <main className="shell grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="grid justify-items-center gap-4">
        <h1 className="text-2xl font-semibold text-ink">{t('pageError.title')}</h1>
        <p className="text-muted">{t('pageError.body')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="min-h-11 rounded-full bg-primary-solid px-5 font-semibold text-primary-foreground">
            {t('pageError.retry')}
          </button>
          <Link href={`/${locale}`} className="inline-flex min-h-11 items-center rounded-full border border-panel-border px-5 font-semibold text-primary">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    </main>
  );
}
