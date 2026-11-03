import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it, vi} from 'vitest';
const videoShareMetadata = vi.hoisted(() => vi.fn(async () => ({title: '固定內容標題'})));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('@/components/layout/SiteHeaderServer', () => ({SiteHeaderServer: ({locale}: {locale: string}) => <a href={`/${locale}`}>Home</a>}));
vi.mock('@/components/layout/SiteFooterServer', () => ({SiteFooterServer: ({locale}: {locale: string}) => <a href={`/${locale}/privacy-policy`}>Privacy</a>}));
vi.mock('@/features/member-videos/MemberVideoZone', () => ({MemberVideoZone: ({publicId, startAt, locale}: {publicId: string; startAt?: number; locale: string}) => <main data-id={publicId} data-time={startAt} lang={locale}/> }));
vi.mock('@/features/member-videos/share-metadata', () => ({videoPublicIdPattern: /^[A-Za-z0-9_-]{11}$/, videoShareMetadata}));
import Page, {dynamic, generateMetadata} from './page';
const id = 'FA0AoBO02uU';
it.each(['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'])('renders short watch with %s navigation and stable identity', async locale => {
  const props = {params: Promise.resolve({locale, id}), searchParams: Promise.resolve({t: '42'})};
  const html = renderToStaticMarkup(await Page(props));
  expect(html).toContain(`href="/${locale}/privacy-policy"`);
  expect(html).toContain('data-id="FA0AoBO02uU"');
  expect(html).toContain('data-time="42"');
  expect(html).toContain(`lang="${locale}"`);
  await expect(generateMetadata(props)).resolves.toEqual({title: '固定內容標題'});
  expect(videoShareMetadata).toHaveBeenLastCalledWith(id);
  expect(dynamic).toBe('force-dynamic');
});
it.each(['abc', 'FA0AoBO02uU!', 'FA0AoBO02u%'])('rejects invalid public locator %s', async id => {
  const props = {params: Promise.resolve({locale: 'en', id}), searchParams: Promise.resolve({})};
  await expect(Page(props)).rejects.toMatchObject({digest: 'NEXT_HTTP_ERROR_FALLBACK;404'});
  await expect(generateMetadata(props)).rejects.toMatchObject({digest: 'NEXT_HTTP_ERROR_FALLBACK;404'});
});
