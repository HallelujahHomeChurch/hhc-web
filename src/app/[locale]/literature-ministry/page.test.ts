import {beforeEach, expect, it, vi} from 'vitest';
const access = vi.hoisted(() => vi.fn());
vi.mock('@/features/weekly/access', () => ({getBulletinAccess: access}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: () => {throw new Error('NOT_FOUND');}}));
import Page, {generateMetadata} from './page';
beforeEach(() => {access.mockReset();});
it.each([Page, generateMetadata])('returns 404 before page or metadata loading when disabled', async (render) => {
  access.mockResolvedValue({enabled: false});
  await expect(render({params: Promise.resolve({locale: 'ja'})})).rejects.toThrow('NOT_FOUND');
});
it.each([Page, generateMetadata])('propagates service failures instead of marking the page absent', async (render) => {
  access.mockRejectedValue(new Error('service unavailable'));
  await expect(render({params: Promise.resolve({locale: 'en'})})).rejects.toThrow('service unavailable');
});
