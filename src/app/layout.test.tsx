import {beforeEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import RootLayout, {generateMetadata} from './layout';

const navigation = vi.hoisted(() => ({pathname: '/ja/about'}));

vi.mock('next/navigation', () => ({usePathname: () => navigation.pathname}));
vi.mock('@/features/site-layout/api', () => ({getSiteLayout: async () => ({
  locale: 'zh-Hant',
  siteName: 'CMS 中文站',
  englishName: 'CMS English Name',
  copyrightHolder: 'CMS 著作權人',
  allRightsReserved: 'CMS 保留權利',
  seoTitleSuffix: 'CMS SEO 標題',
  seoDescriptionFallback: 'CMS SEO 說明',
  header: [],
  legal: [],
  links: {
    churchYoutube: 'https://youtube.com/@cms-church',
    churchFacebook: 'https://www.facebook.com/cms-church',
    musicYoutube: 'https://youtube.com/@cms-music'
  },
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
})}));

describe('RootLayout', () => {
  beforeEach(() => {
    navigation.pathname = '/ja/about';
  });

  it('sets the document language from the localized route', () => {
    expect(renderToStaticMarkup(<RootLayout><main /></RootLayout>)).toContain('<html lang="ja"');
  });

  it('leaves the language undetermined on the neutral root route', () => {
    navigation.pathname = '/';

    expect(renderToStaticMarkup(<RootLayout><main /></RootLayout>)).toContain('<html lang="und"');
  });

  it('uses the published Traditional Chinese projection for global metadata', async () => {
    const metadata = await generateMetadata();

    expect(metadata).toMatchObject({
      title: 'CMS SEO 標題',
      description: 'CMS SEO 說明',
      openGraph: {title: 'CMS SEO 標題', description: 'CMS SEO 說明', siteName: 'CMS 中文站'}
    });
  });
  it('keeps the before-paint theme bootstrap without making the root layout dynamic', () => {
    const layout = RootLayout({children: <main />});

    expect(layout.props.suppressHydrationWarning).toBe(true);
    expect(layout.props.children[0].props.children.props.dangerouslySetInnerHTML.__html).toContain('hhc_theme');
  });

  it('uses system CJK body fonts and local locale-specific banner subsets', () => {
    const fonts = readFileSync('src/app/fonts.ts', 'utf8');
    const styles = readFileSync('src/app/globals.css', 'utf8');

    expect(fonts).not.toContain('Noto_Sans_TC');
    expect(fonts).not.toContain('Noto_Sans_SC');
    expect(fonts).not.toContain("Ma_Shan_Zheng");
    expect(fonts).toContain('MaShanZheng-HHC-Banners.woff2');
    expect(fonts).toContain('KleeOne-HHC-Banners.woff2');
    expect(fonts).toContain('HHC-Pen-Hangul-Banners.woff2');
    expect(fonts.match(/fallback: \['system-ui', 'sans-serif'\]/g)).toHaveLength(2);
    expect(styles).toContain('"PingFang TC"');
    expect(styles).toContain('"PingFang SC"');
    expect(styles).not.toContain('--font-noto-sans');
  });

  it('does not preload locale-specific banner fonts globally', () => {
    const fonts = readFileSync('src/app/fonts.ts', 'utf8');

    expect(fonts.match(/preload: false/g)).toHaveLength(5);
  });

  it('lets unsupported locale segments reach the explicit not-found handling', () => {
    const localeLayout = readFileSync('src/app/[locale]/layout.tsx', 'utf8');

    expect(localeLayout).not.toContain('dynamicParams = false');
  });

  it('uses the legal shell middle row instead of standalone viewport subtractions', () => {
    const styles = readFileSync('src/app/globals.css', 'utf8');

    expect(styles).toMatch(/\.maintenance-status\s*\{[^}]*height: 100%/);
    expect(styles).toMatch(/\.newsletter-unsubscribe\s*\{[^}]*height: 100%/);
    expect(styles).not.toContain('calc(100vh - 184px)');
    expect(styles).not.toContain('calc(100vh - 152px)');
  });
});
