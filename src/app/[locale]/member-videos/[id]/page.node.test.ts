import {beforeEach, expect, it, vi} from 'vitest';
const videoShareMetadata=vi.hoisted(()=>vi.fn().mockResolvedValue({title:'Video'}));
const legacyVideoPath = vi.hoisted(() => vi.fn());
vi.mock('@/features/member-videos/share-metadata', () => ({
  recordingIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  legacyVideoPath,
  videoShareMetadata
}));
import Page,{generateMetadata} from './page';
const id = '11111111-1111-1111-1111-111111111111';
beforeEach(() => { legacyVideoPath.mockReset(); legacyVideoPath.mockResolvedValue('/video/FA0AoBO02uU'); });
it.each(['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'])('permanently redirects eligible %s UUID entry with valid time', async locale => {
  await expect(Page({params: Promise.resolve({locale, id}), searchParams: Promise.resolve({t: '42'})})).rejects.toMatchObject({digest: 'NEXT_REDIRECT;replace;/video/FA0AoBO02uU?t=42;308;'});
  expect(legacyVideoPath).toHaveBeenCalledWith(id);
});
it.each(['-1', '604801', '1.5', '01', ['2', '3']])('drops invalid start time %s', async t => {
  await expect(Page({params: Promise.resolve({locale: 'en', id}), searchParams: Promise.resolve({t})})).rejects.toMatchObject({digest: 'NEXT_REDIRECT;replace;/video/FA0AoBO02uU;308;'});
});
it('does not reveal a mapping when the public preview is ineligible', async () => {
  legacyVideoPath.mockResolvedValue(null);
  await expect(Page({params: Promise.resolve({locale: 'en', id})})).rejects.toMatchObject({digest: 'NEXT_HTTP_ERROR_FALLBACK;404'});
});
it.each([{locale: 'video', id}, {locale: 'en', id: 'FA0AoBO02uU'}])('rejects malformed legacy paths before lookup', async params => {
  await expect(Page({params: Promise.resolve(params)})).rejects.toMatchObject({digest: 'NEXT_HTTP_ERROR_FALLBACK;404'});
  expect(legacyVideoPath).not.toHaveBeenCalled();
});

it('uses the same eligible short canonical for legacy metadata',async()=>{await generateMetadata({params:Promise.resolve({locale:'ja',id})});expect(videoShareMetadata).toHaveBeenCalledWith('FA0AoBO02uU');});
it('does not expose legacy metadata after preview revocation',async()=>{legacyVideoPath.mockResolvedValue(undefined);await expect(generateMetadata({params:Promise.resolve({locale:'ja',id})})).rejects.toMatchObject({digest:'NEXT_HTTP_ERROR_FALLBACK;404'});});
