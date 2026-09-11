import {expect, it, vi} from 'vitest';

const access = vi.hoisted(() => vi.fn());
vi.mock('@/features/weekly/access', () => ({getBulletinAccess: access}));
vi.mock('@/features/site-layout/api', () => ({getSiteLayout: vi.fn().mockResolvedValue({
  siteName: 'HHC', seoTitleSuffix: 'HHC', bannerImageUrl: null
})}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: () => {throw new Error('NOT_FOUND');}}));

import Page, {generateMetadata} from './page';

it('keeps member content behind the client access gate and removes it from search', async () => {
  access.mockResolvedValue({enabled: false});

  const page = await Page({params: Promise.resolve({locale: 'ja'})});
  const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja'})});

  expect(page.props.children[1].props.publicEnabled).toBe(false);
  expect(metadata.robots).toEqual({index: false, follow: false});
});
