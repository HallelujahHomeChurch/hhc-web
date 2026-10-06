import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it, vi} from 'vitest';
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: () => {throw new Error('NOT_FOUND');}}));
import Page, {generateMetadata} from './page';
const params = {locale: 'en', issueNumber: '1739', series: 'general', contentLocale: 'zh-Hant'};
it('serves only a generic noindex shell and no member fetch', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const html = renderToStaticMarkup(await Page({params: Promise.resolve(params)}));
  expect(html).toContain('Enable JavaScript');
  expect(html).not.toContain('data-bulletin-page');
  expect(html).not.toContain('Private weekly');
  expect(await generateMetadata({params: Promise.resolve(params)})).toMatchObject({title: 'Bulletin reader', robots: {index: false, follow: false}});
  expect(fetcher).not.toHaveBeenCalled(); fetcher.mockRestore();
});
it.each([{issueNumber: '0'}, {issueNumber: '1e3'}, {series: 'outside'}, {contentLocale: 'ja'}, {locale: 'invalid'}])('rejects malformed route selectors %j', async invalid => {
  await expect(Page({params: Promise.resolve({...params, ...invalid})})).rejects.toThrow('NOT_FOUND');
});
