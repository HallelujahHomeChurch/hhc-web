'use client';

import {useEffect, useMemo, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/Button';
import {DownloadButton} from '@/components/ui/DownloadButton';
import {createWeeklyBulletinApi, type WeeklyBulletinApi} from '@/features/weekly/api';
import {formatIssueNumber, resolveWeeklyCopy} from '@/features/weekly/format';
import {weeklyEditionLabels, type WeeklyIssue, type WeeklyIssuePage} from '@/features/weekly/types';
import type {Locale} from '@/i18n/locales';
import {useBulletinAccess, useBulletinAuthorization} from '@/components/layout/AccountControl';
import {captureHandledError} from '@/lib/observability';
import type {BulletinSeries} from '@hallelujahhomechurch/preferences';

type WeeklyArchiveMessages = {
  eyebrow: string;
  archiveTitle: string;
  archiveIntro: string;
  latestLabel: string;
  general: string;
  children: string;
  allIssuesTitle: string;
  paginationNote: string;
  paginationLabel: string;
  previousPage: string;
  nextPage: string;
  pageLabel: string;
  loading: string;
  downloading: string;
  downloadReady: string;
  downloadError: string;
  loadError: string;
  retry: string;
  empty: string;
};

type WeeklyArchiveProps = {locale: Locale; messages: WeeklyArchiveMessages};

function getPageValue(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
}

function getPageHref(locale: Locale, series: BulletinSeries, page: number) {
  const params = new URLSearchParams({series});
  if (page > 1) params.set('page', String(page));
  return `/${locale}/literature-ministry?${params}`;
}

export function WeeklyArchive({locale, messages}: WeeklyArchiveProps) {
  const bulletinAccess = useBulletinAccess();
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createWeeklyBulletinApi(authorization), [authorization]);
  const editions = bulletinAccess.editions;
  const canRead = bulletinAccess.status === 'available' && editions.length > 0;
  const searchParams = useSearchParams();
  const availableSeries = useMemo(() => (['general', 'children'] as const).filter((value) => editions.some((edition) => edition.series === value)), [editions]);
  const requestedSeries = searchParams.get('series');
  const series = availableSeries.includes(requestedSeries as BulletinSeries) ? requestedSeries as BulletinSeries : availableSeries[0];
  const locales = useMemo(() => editions.filter((edition) => edition.series === series).map((edition) => edition.locale), [editions, series]);
  const page = getPageValue(searchParams.get('page'));
  const [retryKey, setRetryKey] = useState(0);
  const latestKey = `${series}:${locales.join(',')}:${retryKey}`;
  const archiveKey = `${latestKey}:${page}`;
  const [latestResult, setLatestResult] = useState<{
    key: string;
    state: 'ready' | 'error';
    issue: WeeklyIssue | null;
  } | null>(null);
  const [archiveResult, setArchiveResult] = useState<{
    key: string;
    state: 'ready' | 'error';
    archive: WeeklyIssuePage | null;
  } | null>(null);
  const latestState = latestResult?.key === latestKey ? latestResult.state : 'loading';
  const latestIssue = latestResult?.key === latestKey ? latestResult.issue : null;
  const archiveState = archiveResult?.key === archiveKey ? archiveResult.state : 'loading';
  const archive = archiveResult?.key === archiveKey ? archiveResult.archive : null;

  useEffect(() => {
    if (!canRead || !series) return;
    const controller = new AbortController();
    api.fetchLatest(series, locales, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setLatestResult({key: latestKey, state: 'ready', issue: value});
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          captureHandledError(error, {operation: 'weekly.latest', tags: {locale, series}});
          setLatestResult({key: latestKey, state: 'error', issue: null});
        }
      });
    return () => controller.abort();
  }, [api, canRead, latestKey, locale, locales, series]);

  useEffect(() => {
    if (!canRead || !series) return;
    const controller = new AbortController();
    api.fetchArchive(series, locales, {page, pageSize: 12}, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setArchiveResult({key: archiveKey, state: 'ready', archive: value});
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          captureHandledError(error, {operation: 'weekly.archive', tags: {locale, page, series}});
          setArchiveResult({key: archiveKey, state: 'error', archive: null});
        }
      });
    return () => controller.abort();
  }, [api, archiveKey, canRead, locale, locales, page, series]);

  if (!canRead || !series) return null;

  const latestIssueLabel = formatIssueNumber(locale, latestIssue?.issueNumber);
  const latestCopy = latestIssue ? resolveWeeklyCopy(latestIssue, locale) : null;

  return (
    <section className="shell grid gap-7" aria-labelledby="weekly-archive-title">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,360px)] gap-5 rounded-2xl border border-line/80 bg-paper/90 p-[clamp(22px,4vw,38px)] shadow-warm max-[820px]:grid-cols-1">
        <div>
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{messages.eyebrow}</span>
          <h2 id="weekly-archive-title" className="mt-3 max-w-[720px] text-[clamp(34px,5vw,58px)] font-semibold leading-tight text-ink">{messages.archiveTitle}</h2>
          <p className="mt-4 max-w-[620px] text-lg leading-[1.85] text-muted">{messages.archiveIntro}</p>
          {availableSeries.length > 1 ? <nav aria-label={messages.eyebrow} className="mt-6 inline-flex rounded-full border border-panel-border bg-panel p-1">{availableSeries.map((value) => <a key={value} aria-current={series === value ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${series === value ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-ink'}`} href={getPageHref(locale, value, 1)}>{value === 'general' ? messages.general : messages.children}</a>)}</nav> : null}
        </div>
        <aside className="min-h-[220px] rounded-[14px] border border-panel-border bg-[image:var(--hhc-panel-gradient)] p-5 shadow-[inset_0_1px_0_var(--hhc-inset-highlight)]" aria-labelledby="latest-weekly-title">
          <span id="latest-weekly-title" className="text-sm font-black uppercase tracking-[0.12em] text-teal">{messages.latestLabel}</span>
          {latestState === 'ready' && latestIssue?.versions.length ? (
            <>
              {latestIssueLabel ? <p className="mt-3 text-[21px] font-semibold text-[var(--hhc-brand-strong)]">{latestIssueLabel}</p> : null}
              {latestCopy ? <h3 lang={latestCopy.locale} className="mt-2 text-lg font-semibold leading-snug text-ink">{latestCopy.title}</h3> : null}
              {latestCopy?.subtitle ? <p lang={latestCopy.locale} className="mt-1 text-sm leading-relaxed text-muted">{latestCopy.subtitle}</p> : null}
              <VersionLinks issue={latestIssue} workflow={api} preparingLabel={messages.downloading} readyLabel={messages.downloadReady} errorLabel={messages.downloadError} className="mt-5" />
            </>
          ) : latestState === 'error' ? (
            <div className="mt-4 grid justify-items-start gap-4">
              <h3 className="text-[18px] font-semibold text-ink">{messages.loadError}</h3>
              <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--hhc-control-border)] bg-paper px-5 font-semibold text-[var(--hhc-control)] transition hover:border-primary hover:bg-primary hover:text-primary-foreground" type="button" onClick={() => setRetryKey((value) => value + 1)}>{messages.retry}</button>
            </div>
          ) : (
            <h3 className="mt-4 text-[18px] font-semibold text-muted" aria-live="polite">{messages.loading}</h3>
          )}
        </aside>
      </div>

      <div className="rounded-2xl border border-line/80 bg-paper/90 p-[clamp(18px,3vw,28px)] shadow-warm">
        <div className="mb-5 flex items-end justify-between gap-4 max-[620px]:grid">
          <h3 className="text-2xl font-semibold text-ink">{messages.allIssuesTitle}</h3>
          <p className="text-sm font-semibold text-muted">{messages.paginationNote}</p>
        </div>
        <div className="grid min-h-24 gap-3">
          {archiveState === 'ready' && archive?.items.length ? archive.items.map((issue) => {
            const issueLabel = formatIssueNumber(locale, issue.issueNumber);
            const copy = resolveWeeklyCopy(issue, locale);
            return issue.versions.length ? (
              <article key={issue.id} className="grid grid-cols-[125px_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 rounded-[14px] border border-panel-border bg-panel px-5 py-4 shadow-[inset_0_1px_0_var(--hhc-inset-highlight)] max-[860px]:grid-cols-1">
                {issueLabel ? <p className="whitespace-nowrap text-[21px] font-semibold text-[var(--hhc-brand-strong)]">{issueLabel}</p> : null}
                <div className="min-w-0">
                  {copy ? <h4 lang={copy.locale} className="text-lg font-semibold leading-snug text-ink">{copy.title}</h4> : null}
                  {copy?.subtitle ? <p lang={copy.locale} className="mt-1 text-sm leading-relaxed text-muted">{copy.subtitle}</p> : null}
                </div>
                <VersionLinks issue={issue} workflow={api} preparingLabel={messages.downloading} readyLabel={messages.downloadReady} errorLabel={messages.downloadError} />
              </article>
            ) : null;
          }) : archiveState === 'ready' ? <p className="text-muted">{messages.empty}</p> : archiveState === 'error' ? <p className="text-muted">{messages.loadError}</p> : null}
        </div>
        {archive && archive.totalPages > 1 ? (
          <nav className="mt-6 flex flex-wrap items-center justify-end gap-2" aria-label={messages.paginationLabel}>
            <Button href={getPageHref(locale, series, archive.page - 1)} variant="outline" className={archive.page <= 1 ? 'pointer-events-none opacity-45' : ''}>{messages.previousPage}</Button>
            {Array.from({length: archive.totalPages}, (_, index) => index + 1).map((pageNumber) => (
              <Button key={pageNumber} href={getPageHref(locale, series, pageNumber)} variant={pageNumber === archive.page ? 'primary' : 'outline'} ariaLabel={`${messages.pageLabel} ${pageNumber}`}>{pageNumber}</Button>
            ))}
            <Button href={getPageHref(locale, series, archive.page + 1)} variant="outline" className={archive.page >= archive.totalPages ? 'pointer-events-none opacity-45' : ''}>{messages.nextPage}</Button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function VersionLinks({issue, workflow, preparingLabel, readyLabel, errorLabel, className = ''}: {issue: WeeklyIssue; workflow: WeeklyBulletinApi; preparingLabel: string; readyLabel: string; errorLabel: string; className?: string}) {
  return (
    <div className={`flex justify-end gap-2.5 max-[860px]:grid max-[860px]:grid-flow-col max-[860px]:auto-cols-fr ${className}`}>
      {issue.versions.map((version) => <DownloadButton key={`${version.series}/${version.locale}`} bulletin={version} workflow={workflow} label={weeklyEditionLabels[version.locale]} variant="outline" preparingLabel={preparingLabel} readyLabel={readyLabel} errorLabel={errorLabel} />)}
    </div>
  );
}
