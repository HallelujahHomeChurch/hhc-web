'use client';

import {useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/Button';
import {getWeeklyIssuePage, getWeeklyIssues} from '@/features/weekly/api';
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
  versionLabels: Record<Locale, string>;
};

type WeeklyArchiveProps = {
  locale: Locale;
  messages: WeeklyArchiveMessages;
};

function getPageValue(value: string | null) {
  const page = Number(value);

  return Number.isFinite(page) ? page : 1;
}

function getPageHref(locale: Locale, page: number) {
  return page <= 1 ? `/${locale}/literature-ministry` : `/${locale}/literature-ministry?page=${page}`;
}

export function WeeklyArchive({locale, messages}: WeeklyArchiveProps) {
  const searchParams = useSearchParams();
  const issues = getWeeklyIssues();
  const [latestIssue] = issues;
  const latestVersion = latestIssue.versions.find((version) => version.locale === locale) ?? latestIssue.versions[0];
  const archivePage = getWeeklyIssuePage({locale, page: getPageValue(searchParams.get('page')), pageSize: 12});

  return (
    <section className="shell grid gap-7" aria-labelledby="weekly-archive-title">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,360px)] gap-5 rounded-2xl border border-line/80 bg-paper/90 p-[clamp(22px,4vw,38px)] shadow-warm max-[820px]:grid-cols-1">
        <div>
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{messages.eyebrow}</span>
          <h2 id="weekly-archive-title" className="mt-3 max-w-[720px] text-[clamp(34px,5vw,58px)] font-bold leading-tight text-ink">
            {messages.archiveTitle}
          </h2>
          <p className="mt-4 max-w-[620px] text-lg leading-[1.85] text-muted">{messages.archiveIntro}</p>
        </div>
        <aside className="rounded-[14px] border border-panel-border bg-[linear-gradient(135deg,#fffdf9,#f8f0e7)] p-5 shadow-[inset_0_1px_0_rgb(255_255_255_/_64%)]" aria-labelledby="latest-weekly-title">
          <span className="text-sm font-black uppercase tracking-[0.12em] text-teal">{messages.latestLabel}</span>
          <p className="mt-3 text-[21px] font-bold text-primary">{latestVersion.date}</p>
          <h3 id="latest-weekly-title" className="mt-1 text-[21px] font-bold text-ink">{latestVersion.title}</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{latestVersion.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {latestIssue.versions.map((version) => (
              <Button key={version.locale} href={version.href} variant="outline">
                {messages.versionLabels[version.locale]}
              </Button>
            ))}
          </div>
        </aside>
      </div>

      <div className="rounded-2xl border border-line/80 bg-paper/90 p-[clamp(18px,3vw,28px)] shadow-warm">
        <div className="mb-5 flex items-end justify-between gap-4 max-[620px]:grid">
          <h3 className="text-2xl font-bold text-ink">{messages.allIssuesTitle}</h3>
          <p className="text-sm font-semibold text-muted">{messages.paginationNote}</p>
        </div>
        <div className="grid gap-3">
          {archivePage.items.map((issue) => {
            const localizedVersion = issue.versions.find((version) => version.locale === locale) ?? issue.versions[0];

            return (
              <article key={issue.id} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 rounded-[14px] border border-panel-border bg-panel px-5 py-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_58%)] max-[860px]:grid-cols-1">
                <time className="text-[21px] font-bold text-primary">{issue.date}</time>
                <div>
                  <h4 className="text-[21px] font-bold text-ink">{localizedVersion.title}</h4>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">{localizedVersion.subtitle}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2.5 max-[860px]:justify-start">
                  {issue.versions.map((version) => (
                    <Button key={version.locale} href={version.href} variant="outline">
                      {messages.versionLabels[version.locale]}
                    </Button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {archivePage.totalPages > 1 ? (
          <nav className="mt-6 flex flex-wrap items-center justify-end gap-2" aria-label={messages.paginationLabel}>
            <Button href={getPageHref(locale, archivePage.page - 1)} variant="outline" className={archivePage.page <= 1 ? 'pointer-events-none opacity-45' : ''}>
              {messages.previousPage}
            </Button>
            {Array.from({length: archivePage.totalPages}, (_, index) => index + 1).map((page) => (
              <Button key={page} href={getPageHref(locale, page)} variant={page === archivePage.page ? 'primary' : 'outline'} ariaLabel={`${messages.pageLabel} ${page}`}>
                {page}
              </Button>
            ))}
            <Button href={getPageHref(locale, archivePage.page + 1)} variant="outline" className={archivePage.page >= archivePage.totalPages ? 'pointer-events-none opacity-45' : ''}>
              {messages.nextPage}
            </Button>
          </nav>
        ) : null}
      </div>

    </section>
  );
}
