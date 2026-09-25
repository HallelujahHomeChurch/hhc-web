'use client';

import {useEffect, useMemo, useState} from 'react';
import {DownloadButton} from '@/components/ui/DownloadButton';
import {createWeeklyBulletinApi} from '@/features/weekly/api';
import {formatIssueNumber, resolveWeeklyCopy} from '@/features/weekly/format';
import {weeklyEditionLabels, type WeeklyIssue} from '@/features/weekly/types';
import type {Locale} from '@/i18n/locales';
import {useBulletinAccess, useBulletinAuthorization} from '@/components/layout/AccountControl';
import {captureHandledError} from '@/lib/observability';
import type {BulletinSeries} from '@hallelujahhomechurch/preferences';

type WeeklyCardProps = {
  locale: Locale;
  ctaLabel: string;
  messages: {general: string; children: string; loading: string; downloading: string; downloadReady: string; downloadError: string; error: string; retry: string};
};

export function WeeklyCard({locale, ctaLabel, messages}: WeeklyCardProps) {
  const bulletinAccess = useBulletinAccess();
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createWeeklyBulletinApi(authorization), [authorization]);
  const editions = bulletinAccess.editions;
  const canRead = bulletinAccess.status === 'available' && editions.length > 0;
  const series = useMemo(() => (['general', 'children'] as const).filter((value) => editions.some((edition) => edition.series === value)), [editions]);
  const [selectedSeries, setSelectedSeries] = useState<BulletinSeries>('general');
  const [retryKey, setRetryKey] = useState(0);
  const requestKey = `${editions.map(({series, locale}) => `${series}/${locale}`).join(',')}:${retryKey}`;
  const [results, setResults] = useState<Partial<Record<BulletinSeries, {key: string; state: 'ready' | 'error'; weekly: WeeklyIssue | null}>>>({});
  const activeSeries = series.includes(selectedSeries) ? selectedSeries : series[0];
  const result = activeSeries ? results[activeSeries] : undefined;
  const state = result?.key === requestKey ? result.state : 'loading';
  const weekly = result?.key === requestKey ? result.weekly : null;
  const issueLabel = formatIssueNumber(locale, weekly?.issueNumber);
  const copy = weekly ? resolveWeeklyCopy(weekly, locale) : null;

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    for (const bulletinSeries of series) {
      const locales = editions.filter((edition) => edition.series === bulletinSeries).map((edition) => edition.locale);
      api.fetchLatest(bulletinSeries, locales, controller.signal)
        .then((value) => {
          if (controller.signal.aborted) return;
          setResults((current) => ({...current, [bulletinSeries]: {key: requestKey, state: 'ready', weekly: value}}));
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            captureHandledError(error, {operation: 'weekly.latest', tags: {locale, series: bulletinSeries}});
            setResults((current) => ({...current, [bulletinSeries]: {key: requestKey, state: 'error', weekly: null}}));
          }
        });
    }
    return () => controller.abort();
  }, [api, canRead, editions, locale, requestKey, series]);

  if (!canRead) return null;

  return (
    <aside data-weekly-card className="grid min-h-[350px] place-items-center rounded-[14px] border border-panel-border bg-panel px-6 py-8 text-center shadow-[inset_0_1px_0_var(--hhc-inset-highlight)] max-[900px]:order-first" aria-labelledby="weekly-title">
      {series.length > 1 ? <div role="tablist" aria-label={ctaLabel} className="mb-5 inline-flex rounded-full border border-panel-border bg-paper p-1">
        {series.map((value, index) => <button key={value} id={`weekly-tab-${value}`} role="tab" aria-controls="weekly-series-panel" aria-selected={activeSeries === value} tabIndex={activeSeries === value ? 0 : -1} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${activeSeries === value ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-ink'}`} type="button" onClick={() => setSelectedSeries(value)} onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const next = series[(index + (event.key === 'ArrowRight' ? 1 : series.length - 1)) % series.length];
          setSelectedSeries(next);
          event.currentTarget.parentElement?.querySelector<HTMLElement>(`#weekly-tab-${next}`)?.focus();
        }}>{value === 'general' ? messages.general : messages.children}</button>)}
      </div> : null}
      <div id="weekly-series-panel" role={series.length > 1 ? 'tabpanel' : undefined} aria-labelledby={series.length > 1 ? `weekly-tab-${activeSeries}` : undefined}>
      {state === 'ready' && weekly ? (
        <div>
          <BulletinMark />
          {issueLabel ? <p className="mb-1 text-[21px] font-semibold text-[var(--hhc-brand-strong)]">{issueLabel}</p> : null}
          {copy ? <h3 id="weekly-title" lang={copy.locale} className="text-xl font-semibold leading-snug text-ink">{copy.title}</h3> : <h3 id="weekly-title" className="sr-only">{ctaLabel}</h3>}
          {copy?.subtitle ? <p lang={copy.locale} className="mt-1 text-sm leading-relaxed text-muted">{copy.subtitle}</p> : null}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {weekly.versions.map((version) => (
              <DownloadButton
                key={`${version.series}/${version.locale}`}
                bulletin={version}
                workflow={api}
                label={weeklyEditionLabels[version.locale]}
                ariaLabel={`${ctaLabel}: ${weeklyEditionLabels[version.locale]}`}
                className="px-3 text-sm"
                preparingLabel={messages.downloading}
                readyLabel={messages.downloadReady}
                errorLabel={messages.downloadError}
              />
            ))}
          </div>
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
      </div>
    </aside>
  );
}

function BulletinMark() {
  return <div className="mx-auto mb-6 grid size-28 place-items-center rounded-full bg-[var(--hhc-badge-rose)] text-5xl text-primary-hover" aria-hidden="true">▤</div>;
}
