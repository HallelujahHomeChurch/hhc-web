'use client';

import {useEffect, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/Button';
import {fetchWeeklyArchive} from '@/features/weekly/public-api';
import type {WeeklyIssue, WeeklyIssuePage} from '@/features/weekly/types';
import type {Locale} from '@/i18n/locales';

type WeeklyArchiveMessages = {
  eyebrow: string;
  archiveTitle: string;
  archiveIntro: string;
  latestLabel: string;
  allIssuesTitle: string;
  paginationNote: string;
  paginationLabel: string;
  previousPage: string;
  nextPage: string;
  pageLabel: string;
  loading: string;
  loadError: string;
  retry: string;
  empty: string;
  versionLabels: Record<Locale, string>;
};

type WeeklyArchiveProps = {locale: Locale; messages: WeeklyArchiveMessages};

function getPageValue(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
}

function getPageHref(locale: Locale, page: number) {
  return page <= 1 ? `/${locale}/literature-ministry` : `/${locale}/literature-ministry?page=${page}`;
}

export function WeeklyArchive({locale, messages}: WeeklyArchiveProps) {
  const searchParams = useSearchParams();
  const page = getPageValue(searchParams.get('page'));
  const [retryKey, setRetryKey] = useState(0);
  const requestKey = `${page}:${retryKey}`;
  const [result, setResult] = useState<{
    key: string;
    state: 'ready' | 'error';
    archive: WeeklyIssuePage | null;
  } | null>(null);
  const state = result?.key === requestKey ? result.state : 'loading';
  const archive = result?.key === requestKey ? result.archive : null;

  useEffect(() => {
    const controller = new AbortController();
    fetchWeeklyArchive({page, pageSize: 12}, {signal: controller.signal})
      .then((value) => {
        setResult({key: requestKey, state: 'ready', archive: value});
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResult({key: requestKey, state: 'error', archive: null});
        }
      });
    return () => controller.abort();
  }, [page, requestKey]);

  const latestIssue = archive?.items[0];
  const latestVersion = localizedVersion(latestIssue, locale);

  return (
    <section className="shell grid gap-7" aria-labelledby="weekly-archive-title">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,360px)] gap-5 rounded-2xl border border-line/80 bg-paper/90 p-[clamp(22px,4vw,38px)] shadow-warm max-[820px]:grid-cols-1">
        <div>
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{messages.eyebrow}</span>
          <h2 id="weekly-archive-title" className="mt-3 max-w-[720px] text-[clamp(34px,5vw,58px)] font-semibold leading-tight text-ink">{messages.archiveTitle}</h2>
          <p className="mt-4 max-w-[620px] text-lg leading-[1.85] text-muted">{messages.archiveIntro}</p>
        </div>
        <aside className="min-h-[220px] rounded-[14px] border border-panel-border bg-[image:var(--hhc-panel-gradient)] p-5 shadow-[inset_0_1px_0_var(--hhc-inset-highlight)]" aria-labelledby="latest-weekly-title">
          <span className="text-sm font-black uppercase tracking-[0.12em] text-teal">{messages.latestLabel}</span>
          {state === 'ready' && latestIssue && latestVersion ? (
            <>
              <p className="mt-3 text-[21px] font-semibold text-primary">{latestVersion.date}</p>
              <h3 id="latest-weekly-title" className="mt-1 text-[21px] font-semibold text-ink">{latestVersion.title}</h3>
              {latestVersion.subtitle ? <p className="mt-1 text-[15px] leading-relaxed text-ink">{latestVersion.subtitle}</p> : null}
              <VersionLinks issue={latestIssue} messages={messages} className="mt-5" />
            </>
          ) : state === 'error' ? (
            <div className="mt-4 grid justify-items-start gap-4">
              <h3 id="latest-weekly-title" className="text-[21px] font-semibold text-ink">{messages.loadError}</h3>
              <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--hhc-control-border)] bg-paper px-5 font-semibold text-[var(--hhc-control)] transition hover:border-primary hover:bg-primary hover:text-primary-foreground" type="button" onClick={() => setRetryKey((value) => value + 1)}>{messages.retry}</button>
            </div>
          ) : (
            <h3 id="latest-weekly-title" className="mt-4 text-[21px] font-semibold text-muted" aria-live="polite">{messages.loading}</h3>
          )}
        </aside>
      </div>

      <div className="rounded-2xl border border-line/80 bg-paper/90 p-[clamp(18px,3vw,28px)] shadow-warm">
        <div className="mb-5 flex items-end justify-between gap-4 max-[620px]:grid">
          <h3 className="text-2xl font-semibold text-ink">{messages.allIssuesTitle}</h3>
          <p className="text-sm font-semibold text-muted">{messages.paginationNote}</p>
        </div>
        <div className="grid min-h-24 gap-3">
          {state === 'ready' && archive?.items.length ? archive.items.map((issue) => {
            const version = localizedVersion(issue, locale);
            return version ? (
              <article key={issue.id} className="grid grid-cols-[125px_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 rounded-[14px] border border-panel-border bg-panel px-5 py-4 shadow-[inset_0_1px_0_var(--hhc-inset-highlight)] max-[860px]:grid-cols-1">
                <time className="whitespace-nowrap text-[21px] font-semibold text-primary">{issue.date}</time>
                <div>
                  <h4 className="text-[21px] font-semibold text-ink">{version.title}</h4>
                  {version.subtitle ? <p className="mt-1 text-[15px] leading-relaxed text-ink">{version.subtitle}</p> : null}
                </div>
                <VersionLinks issue={issue} messages={messages} />
              </article>
            ) : null;
          }) : state === 'ready' ? <p className="text-muted">{messages.empty}</p> : null}
        </div>
        {archive && archive.totalPages > 1 ? (
          <nav className="mt-6 flex flex-wrap items-center justify-end gap-2" aria-label={messages.paginationLabel}>
            <Button href={getPageHref(locale, archive.page - 1)} variant="outline" className={archive.page <= 1 ? 'pointer-events-none opacity-45' : ''}>{messages.previousPage}</Button>
            {Array.from({length: archive.totalPages}, (_, index) => index + 1).map((pageNumber) => (
              <Button key={pageNumber} href={getPageHref(locale, pageNumber)} variant={pageNumber === archive.page ? 'primary' : 'outline'} ariaLabel={`${messages.pageLabel} ${pageNumber}`}>{pageNumber}</Button>
            ))}
            <Button href={getPageHref(locale, archive.page + 1)} variant="outline" className={archive.page >= archive.totalPages ? 'pointer-events-none opacity-45' : ''}>{messages.nextPage}</Button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function localizedVersion(issue: WeeklyIssue | undefined, locale: Locale) {
  return issue?.versions.find((version) => version.locale === locale) ?? issue?.versions[0];
}

function VersionLinks({issue, messages, className = ''}: {issue: WeeklyIssue; messages: WeeklyArchiveMessages; className?: string}) {
  return (
    <div className={`flex flex-wrap justify-end gap-2.5 max-[860px]:justify-start ${className}`}>
      {issue.versions.map((version) => <Button key={version.locale} href={version.href} variant="outline">{messages.versionLabels[version.locale]}</Button>)}
    </div>
  );
}
