import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {productLocales} from '@/i18n/locales';
import {WeeklyCard} from './WeeklyCard';

afterEach(() => vi.unstubAllGlobals());

describe('WeeklyCard', () => {
  const issueLabels = {
    'zh-Hant': '第 1732 期',
    'zh-Hans': '第 1732 期',
    en: 'Issue 1732',
    ja: '第1732号',
    ko: '제1732호'
  } as const;

  it.each(productLocales)('renders the same three edition downloads on the %s product route', async (locale) => {
    const fetcher = vi.fn().mockResolvedValue(apiResponse([latestIssue()]));
    vi.stubGlobal('fetch', fetcher);

    render(<WeeklyCard locale={locale} ctaLabel="Download weekly" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);

    expect(await screen.findByRole('link', {name: 'Download weekly: 繁中'})).toHaveAttribute('href', '/zh-Hant.pdf');
    expect(screen.getByRole('link', {name: 'Download weekly: 简中'})).toHaveAttribute('href', '/zh-Hans.pdf');
    expect(screen.getByRole('link', {name: 'Download weekly: English'})).toHaveAttribute('href', '/en.pdf');
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText(issueLabels[locale])).toHaveClass('text-[var(--hhc-brand-strong)]');
    expect(screen.queryByText('2026-07-13')).not.toBeInTheDocument();
    expect(screen.queryByText(/title$/)).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('/api/bulletins?page=1&pageSize=1', expect.any(Object));
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain('locale=');
  });

  it('allows retry after a load failure', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(apiResponse(null, {code: 'unavailable', message: 'Unavailable'}, 503))
      .mockResolvedValueOnce(apiResponse([latestIssue()]));
    vi.stubGlobal('fetch', fetcher);
    render(<WeeklyCard locale="en" ctaLabel="Download" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByRole('link', {name: 'Download: English'})).toHaveAttribute('href', '/en.pdf');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts the active request when the card unmounts', () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>(() => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }));
    vi.stubGlobal('fetch', fetcher);

    const {unmount} = render(<WeeklyCard locale="en" ctaLabel="Download" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);
    const signal = fetcher.mock.calls[0]?.[1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

function apiResponse(data: unknown, error: unknown = null, status = 200) {
  return new Response(JSON.stringify({data, meta: {}, error}), {status});
}

function latestIssue() {
  return {
    issueNumber: 1732,
    issueDate: '2026-07-13',
    versions: ['zh-Hant', 'zh-Hans', 'en'].map((locale) => ({
      issueNumber: 1732,
      issueDate: '2026-07-13',
      locale,
      title: `${locale} title`,
      subtitle: `${locale} subtitle`,
      downloadUrl: `/${locale}.pdf`,
      publishedAt: '2026-07-13T04:00:00Z',
      version: 3
    }))
  };
}
