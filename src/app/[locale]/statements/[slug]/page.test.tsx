import {renderToStaticMarkup} from 'react-dom/server';
import type {ReactNode} from 'react';
import {beforeEach, expect, it, vi} from 'vitest';
const {news} = vi.hoisted(() => ({news: vi.fn()}));
vi.mock('@/features/news/api', () => ({getNewsBySlug: news}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: () => {throw new Error('404');}}));
vi.mock('@/components/legal/LegalPageShell', () => ({LegalPageShell: ({children}: {children: ReactNode}) => children}));
vi.mock('@/features/site-layout/api', () => ({getSiteLayout: async () => ({seoTitleSuffix: 'HHC', siteName: 'HHC'})}));
import StatementPage, {generateMetadata} from './page';
const params = Promise.resolve({locale: 'en', slug: 'notice'});
beforeEach(() => news.mockResolvedValue({kind: 'statement', title: '聲明', body: '第一段\n\n署名', displayDate: '2026-09-07', date: '2026年9月7日', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant'], popupEndsAt: '2020-01-01T00:00:00Z'}));
it('keeps an expired statement readable with noindex and source-locale metadata', async () => {
  const metadata = await generateMetadata({params});
  expect(metadata.robots).toEqual({index: false, follow: true});
  expect(metadata.alternates?.canonical).toBe('/zh-Hant/statements/notice');
  const markup = renderToStaticMarkup(await StatementPage({params}));
  expect(markup).toContain('lang="zh-Hant"');
  expect(markup).toContain('第一段\n\n署名');
  expect(markup).not.toContain('expired');
  expect(markup).not.toContain('Website notifications');
  expect(markup).not.toContain('account.alive.org.tw/profile');
});
it('does not expose general news through a statement URL', async () => {
  news.mockResolvedValue({kind: 'general'});
  await expect(StatementPage({params})).rejects.toThrow('404');
});
