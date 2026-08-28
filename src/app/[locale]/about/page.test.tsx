import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({getAboutPage: vi.fn(), getHistoryTimeline: vi.fn(), getSiteLayout: vi.fn()}));
vi.mock('@/features/pages/api', () => ({getAboutPage: mocks.getAboutPage}));
vi.mock('@/features/history/api', () => ({getHistoryTimeline: mocks.getHistoryTimeline}));
vi.mock('@/features/site-layout/api', () => ({getSiteLayout: mocks.getSiteLayout}));
vi.mock('@/components/layout/SiteHeaderServer', () => ({SiteHeaderServer: () => null}));
vi.mock('@/components/layout/SiteFooterServer', () => ({SiteFooterServer: () => null}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));

import AboutPage, {generateMetadata} from './page';

describe('CMS-managed About page', () => {
  it('passes CMS fixed content to existing components and preserves the history API', async () => {
    mocks.getAboutPage.mockResolvedValue(aboutPage());
    mocks.getHistoryTimeline.mockResolvedValue({events: [{date: '2026', body: 'CMS timeline event', resolvedLocale: 'en', availableLocales: ['en']}]});

    const markup = renderToStaticMarkup(await AboutPage({params: Promise.resolve({locale: 'en'})}));

    expect(markup).toContain('CMS About hero');
    expect(markup).toContain('CMS vision intro');
    expect(markup).toContain('CMS scripture line');
    expect(markup).toContain('CMS timeline event');
    expect(mocks.getHistoryTimeline).toHaveBeenCalledWith('en');
  });

  it('uses CMS hero copy and published locales for metadata', async () => {
    mocks.getAboutPage.mockResolvedValue(aboutPage());
    mocks.getSiteLayout.mockResolvedValue({seoTitleSuffix: 'CMS SEO', seoDescriptionFallback: 'Fallback', siteName: 'CMS Site'});

    const metadata = await generateMetadata({params: Promise.resolve({locale: 'en'})});

    expect(metadata.title).toBe('CMS About hero | CMS SEO');
    expect(metadata.description).toBe('CMS About subtitle');
    expect(metadata.alternates?.languages).toEqual({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant/about',
      en: 'https://www.alive.org.tw/en/about'
    });
  });
});

function aboutPage() {
  return {source: 'cms', indexable: true, availableLocales: ['zh-Hant', 'en'], content: {
    heroTitle: 'CMS About hero', heroSubtitle: 'CMS About subtitle',
    vision: {intro: 'CMS vision intro', imageAlt: 'CMS vision image', actionsImageAlt: 'CMS action images', sections: [
      {eyebrow: 'One', title: 'One title', body: 'One body'},
      {eyebrow: 'Two', title: 'Two title', body: 'Two body'},
      {eyebrow: 'Three', title: 'Three title', cards: [{title: 'Card 1', body: 'Card body 1'}]},
      {eyebrow: 'Four', title: 'Four title', cards: [{title: 'Card 2', body: 'Card body 2'}]}
    ]},
    history: {scripture: [{lines: ['CMS scripture line'], cite: 'CMS citation'}], imageAlt: 'CMS history image', intro: 'CMS history intro', title: 'CMS history title'}
  }};
}
