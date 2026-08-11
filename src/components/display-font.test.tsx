import {render, screen} from '@testing-library/react';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {AboutHero} from './about/AboutHero';
import {HomeHero} from './home/HomeHero';

vi.mock('@/app/fonts', () => ({
  bannerFontByLocale: {
    'zh-Hant': {className: 'font-chenyuluoyan-banner'},
    'zh-Hans': {className: 'font-ma-shan-zheng'},
    en: {className: 'font-chenyuluoyan-banner'},
    ja: {className: 'font-klee-one-banner'},
    ko: {className: 'font-hhc-pen-hangul-banner'}
  }
}));

describe.each([
  ['HomeHero', HomeHero],
  ['AboutHero', AboutHero]
] as const)('%s display font', (_name, Hero) => {
  it.each([
    ['zh-Hant', 'font-chenyuluoyan-banner'],
    ['zh-Hans', 'font-ma-shan-zheng'],
    ['en', 'font-chenyuluoyan-banner'],
    ['ja', 'font-klee-one-banner'],
    ['ko', 'font-hhc-pen-hangul-banner']
  ] as const)('uses the reviewed banner font for %s', (locale, expectedClass) => {
    render(<Hero locale={locale} title="Title" subtitle="Subtitle" />);

    expect(screen.getByRole('heading', {name: 'Title'})).toHaveClass(expectedClass);
    expect(screen.getByText('Subtitle')).toHaveClass(expectedClass);
  });

  it.each([
    ['ja', 'text-[clamp(42px,5vw,68px)]', 'tracking-[0.03em]', 'max-[620px]:text-[clamp(32px,10vw,44px)]'],
    ['ko', 'text-[clamp(44px,5.5vw,72px)]', 'tracking-[0.01em]', 'max-[620px]:text-[clamp(32px,10vw,44px)]']
  ] as const)('uses locale-tuned banner sizing for %s', (locale, desktopSize, tracking, mobileSize) => {
    render(<Hero locale={locale} title="Title" subtitle="Subtitle" />);

    expect(screen.getByRole('heading', {name: 'Title'})).toHaveClass(desktopSize, tracking, mobileSize);
    expect(screen.getByText('Subtitle')).toHaveClass('text-[clamp(20px,2.2vw,28px)]', tracking);
  });
});

describe.each([
  [
    'Klee One',
    'src/assets/fonts/klee-one/SOURCE.md',
    'src/assets/fonts/klee-one/OFL.txt',
    'bf4063f030cc2ae6adf0a11424a1888e5c0eb4438f1f6d02f52294af868e9b3a',
    'src/assets/fonts/klee-one/KleeOne-HHC-Banners.woff2',
    'ca74dd4d7077eb3c74ea20f246d9180e23345647437a65e4926fd2fd4b07997e'
  ],
  [
    'HHC Pen Hangul',
    'src/assets/fonts/hhc-pen-hangul/SOURCE.md',
    'src/assets/fonts/hhc-pen-hangul/OFL.txt',
    '6f0d1ab29c7894010dc88831fb7a0a51edb79136e450344183de5b1a8b52bd43',
    'src/assets/fonts/hhc-pen-hangul/HHC-Pen-Hangul-Banners.woff2',
    'e7555c6cc71185d0bbc10ad9b15ddd6fd762e1987fc9a6e9fa571556468c6d7d'
  ]
] as const)('%s source', (_name, sourcePath, licensePath, sourceHash, derivedPath, derivedHash) => {
  it('records the pinned official revision, source hash, copyright, and OFL', () => {
    const source = readFileSync(sourcePath, 'utf8');
    const license = readFileSync(licensePath, 'utf8');

    expect(source).toContain('google/fonts');
    expect(source).toContain('038b637da7b3fd956a4ed93ffc607c3d5e4ce172');
    expect(source).toContain(sourceHash);
    expect(source).toContain(derivedHash);
    expect(createHash('sha256').update(readFileSync(derivedPath)).digest('hex')).toBe(derivedHash);
    expect(license).toMatch(/^Copyright /);
    expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});
