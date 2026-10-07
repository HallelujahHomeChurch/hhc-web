import {expect, it} from 'vitest';
import robots from './robots';
import {locales} from '@/i18n/locales';
it('excludes statement articles from crawling in every locale', () => {
  const result = robots();
  expect(result.rules).toMatchObject({userAgent: '*', allow: '/', disallow: locales.map((locale) => `/${locale}/statements/`)});
});
