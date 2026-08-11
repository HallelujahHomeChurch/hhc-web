import {describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import RootLayout from './layout';

vi.mock('next/navigation', () => ({usePathname: () => '/ja/about'}));

describe('RootLayout', () => {
  it('sets the document language from the localized route', () => {
    expect(renderToStaticMarkup(<RootLayout><main /></RootLayout>)).toContain('<html lang="ja"');
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
});
