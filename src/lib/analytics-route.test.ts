import { expect, it } from 'vitest';
import { publicAnalyticsRoute } from './analytics-route';
it('normalizes only public routes and excludes private or token-bearing destinations', () => {
  expect(publicAnalyticsRoute('/zh-Hant', '', '')).toBe('home');
  expect(publicAnalyticsRoute('/en/news/example', '', '')).toBe('news_detail');
  for (const path of [
    '/en/privacy-policy',
    '/en/terms-of-use',
    '/en/member-videos',
    '/en/newsletter/unsubscribe',
    '/en/literature-ministry/read/secret',
    '/en/statements/private',
  ])
    expect(publicAnalyticsRoute(path, '', '')).toBeNull();
  expect(publicAnalyticsRoute('/en/news', '?token=private', '')).toBeNull();
  expect(publicAnalyticsRoute('/en/about', '', '#token=private')).toBeNull();
});
