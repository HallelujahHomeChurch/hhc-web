import {expect, it, vi} from 'vitest';
vi.mock('@/features/site-layout/api', () => ({getSiteLayout: vi.fn().mockResolvedValue({
  siteName: 'HHC', seoTitleSuffix: 'HHC', bannerImageUrl: null
})}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: () => {throw new Error('NOT_FOUND');}}));

import Page, {generateMetadata} from './page';
import {BulletinAccessGate} from '@/components/layout/AccountControl';

it('keeps member content behind the client access gate and removes it from search', async () => {

  const page = await Page({params: Promise.resolve({locale: 'ja'})});
  const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja'})});

  const main=page.props.children[1];
  expect(main.type).toBe('main');
  const gate=main.props.children[1].props.children;
  expect(gate.type).toBe(BulletinAccessGate);
  expect(gate.props.loadingFallback).toBeDefined();
  expect(metadata.robots).toEqual({index: false, follow: false});
});
