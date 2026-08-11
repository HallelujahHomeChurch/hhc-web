import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {productLocales} from '@/i18n/locales';
import {WeeklyArchive} from './WeeklyArchive';

vi.mock('next/navigation', () => ({useSearchParams: () => new URLSearchParams()}));
afterEach(() => vi.unstubAllGlobals());

describe('WeeklyArchive', () => {
  it.each(productLocales)('renders the same three edition downloads on the %s product route', async (locale) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      const url = new URL(input, 'https://www.alive.org.tw');
      const versions = ['zh-Hant', 'zh-Hans', 'en'].map((locale) => ({
        issueNumber: 1732, issueDate: '2026-07-13', locale, title: `${locale} title`, downloadUrl: `/${locale}.pdf`, publishedAt: '2026-07-13T04:00:00Z', version: 3
      }));
      return Promise.resolve(new Response(JSON.stringify({
        data: url.pathname.endsWith('/latest') ? versions[2] : [{issueNumber: 1732, issueDate: '2026-07-13', versions}],
        meta: {page: 1, pageSize: 12, total: 1}, error: null
      }), {status: 200}));
    }));

    render(<WeeklyArchive locale={locale} messages={messages} />);

    expect((await screen.findAllByRole('link', {name: '繁中'})).length).toBeGreaterThan(0);
    expect(screen.getAllByText(locale === 'en' ? 'Issue 1732' : '第 1732 期')[0]).toHaveClass('text-[var(--hhc-brand-strong)]');
    expect(screen.queryByText('2026-07-13')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: '繁中'})[0]).toHaveAttribute('href', '/zh-Hant.pdf');
    expect(screen.getAllByRole('link', {name: '繁中'})[0]).toHaveAttribute('download', '');
    expect(screen.getAllByRole('link', {name: '简中'})[0]).toHaveAttribute('href', '/zh-Hans.pdf');
    expect(screen.getAllByRole('link', {name: 'English'})[0]).toHaveAttribute('href', '/en.pdf');
    expect(screen.getAllByRole('link', {name: '繁中'})[0].parentElement).toHaveClass('max-[860px]:grid-flow-col');
    expect(screen.queryByText(/title$/)).not.toBeInTheDocument();
  });

  it('does not render a download for an unavailable locale version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        issueDate: '2026-07-13',
        versions: [{
          issueDate: '2026-07-13', locale: 'zh-Hant', title: 'Traditional title',
          downloadUrl: '/zh-Hant.pdf', publishedAt: '2026-07-13T04:00:00Z', version: 3
        }]
      }],
      meta: {page: 1, pageSize: 12, total: 1}, error: null
    }), {status: 200})));

    render(<WeeklyArchive locale="en" messages={messages} />);

    expect((await screen.findAllByRole('link', {name: '繁中'})).length).toBeGreaterThan(0);
    expect(screen.queryByText('Traditional title')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '简中'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'English'})).not.toBeInTheDocument();
  });

  it('filters unexpected response editions without selecting a product-locale title', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        issueDate: '2026-07-13',
        versions: ['ja', 'ko', 'en', 'zh-Hans', 'zh-Hant'].map((locale) => ({
          issueDate: '2026-07-13', locale, title: `${locale} title`,
          downloadUrl: `/${locale}.pdf`, publishedAt: '2026-07-13T04:00:00Z', version: 3
        }))
      }],
      meta: {page: 1, pageSize: 12, total: 1}, error: null
    }), {status: 200})));

    render(<WeeklyArchive locale="ja" messages={messages} />);

    expect((await screen.findAllByRole('link', {name: '繁中'})).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: '繁中'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: '简中'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: 'English'}).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', {name: '日本語'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '한국어'})).not.toBeInTheDocument();
    expect(screen.queryByText(/title$/)).not.toBeInTheDocument();
  });
});

const messages = {
  eyebrow: 'Weekly Paper', archiveTitle: 'Downloads', archiveIntro: 'Available languages', latestLabel: 'Latest',
  allIssuesTitle: 'History', paginationNote: 'Newest first', paginationLabel: 'Pages', previousPage: 'Previous',
  nextPage: 'Next', pageLabel: 'Page', loading: 'Loading', loadError: 'Unavailable', retry: 'Retry', empty: 'No bulletins',
  downloading: 'Preparing download'
};
