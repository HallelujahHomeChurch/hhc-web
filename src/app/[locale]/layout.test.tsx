import {describe, expect, it, vi} from 'vitest';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import LocaleLayout, {generateStaticParams} from './layout';

vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));

describe('LocaleLayout', () => {
  it('generates every product locale in canonical order', () => {
    expect(generateStaticParams()).toEqual([
      {locale: 'zh-Hant'},
      {locale: 'zh-Hans'},
      {locale: 'en'},
      {locale: 'ja'},
      {locale: 'ko'}
    ]);
  });

  it('marks localized content with its actual language', async () => {
    for (const locale of ['ja', 'ko']) {
      const layout = await LocaleLayout({
        children: <main />,
        params: Promise.resolve({locale})
      });
      expect(layout.props.children.props.lang).toBe(locale);
    }
  });

  it('does not add a global loading page', () => {
    expect(existsSync(join(process.cwd(), 'src/app/loading.tsx'))).toBe(false);
  });
});
