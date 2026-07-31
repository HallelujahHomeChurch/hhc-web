import {describe, expect, it, vi} from 'vitest';
import LocaleLayout from './layout';

vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));

describe('LocaleLayout', () => {
  it('marks localized content with its actual language', async () => {
    const layout = await LocaleLayout({
      children: <main />,
      params: Promise.resolve({locale: 'en'})
    });

    expect(layout.props.children.props.lang).toBe('en');
  });
});
