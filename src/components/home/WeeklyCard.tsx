'use client';

import {useEffect, useState} from 'react';
import {DownloadButton} from '@/components/ui/DownloadButton';
import {fetchLatestWeekly} from '@/features/weekly/public-api';
import {formatIssueNumber} from '@/features/weekly/format';
import type {WeeklyBulletin} from '@/features/weekly/types';
import type {Locale} from '@/i18n/locales';

type WeeklyCardProps = {
  locale: Locale;
  ctaLabel: string;
  messages: {loading: string; downloading: string; error: string; retry: string};
};

export function WeeklyCard({locale, ctaLabel, messages}: WeeklyCardProps) {
  const [retryKey, setRetryKey] = useState(0);
  const requestKey = `${locale}:${retryKey}`;
  const [result, setResult] = useState<{
    key: string;
    state: 'ready' | 'error';
    weekly: WeeklyBulletin | null;
  } | null>(null);
  const state = result?.key === requestKey ? result.state : 'loading';
  const weekly = result?.key === requestKey ? result.weekly : null;
  const issueLabel = formatIssueNumber(locale, weekly?.issueNumber);

  useEffect(() => {
    const controller = new AbortController();
    fetchLatestWeekly(locale, {signal: controller.signal})
      .then((value) => {
        setResult({key: requestKey, state: 'ready', weekly: value});
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResult({key: requestKey, state: 'error', weekly: null});
        }
      });
    return () => controller.abort();
  }, [locale, requestKey]);

  return (
    <aside className="grid min-h-[350px] place-items-center rounded-[14px] border border-panel-border bg-panel px-6 py-8 text-center shadow-[inset_0_1px_0_var(--hhc-inset-highlight)] max-[900px]:order-first" aria-labelledby="weekly-title">
      {state === 'ready' && weekly ? (
        <div>
          <BulletinMark />
          {issueLabel ? <p className="mb-1 text-[21px] font-semibold text-primary">{issueLabel}</p> : null}
          <h3 id="weekly-title" className="mb-1 text-[18px] font-semibold text-ink">{weekly.title}</h3>
          {weekly.subtitle ? <p className="mb-6 text-[15px] text-ink">{weekly.subtitle}</p> : <div className="mb-5" />}
          <DownloadButton href={weekly.href} label={ctaLabel} />
        </div>
      ) : state === 'error' ? (
        <div>
          <BulletinMark />
          <h3 id="weekly-title" className="mb-5 text-[18px] font-semibold text-ink">{messages.error}</h3>
          <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--hhc-control-border)] bg-paper px-5 font-semibold text-[var(--hhc-control)] transition hover:border-primary hover:bg-primary hover:text-primary-foreground" type="button" onClick={() => setRetryKey((value) => value + 1)}>
            {messages.retry}
          </button>
        </div>
      ) : (
        <div aria-live="polite">
          <BulletinMark />
          <h3 id="weekly-title" className="text-[18px] font-semibold text-muted">{messages.loading}</h3>
        </div>
      )}
    </aside>
  );
}

function BulletinMark() {
  return <div className="mx-auto mb-6 grid size-28 place-items-center rounded-full bg-[var(--hhc-badge-rose)] text-5xl text-primary-hover" aria-hidden="true">▤</div>;
}
