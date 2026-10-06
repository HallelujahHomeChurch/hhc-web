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
    ['ja', 'text-[clamp(44px,5.8vw,76px)]', 'tracking-[0.03em]', 'max-[620px]:text-[clamp(34px,10vw,46px)]', 'text-[clamp(24px,3.5vw,36px)]', 'max-[620px]:text-[clamp(21px,7vw,29px)]'],
    ['ko', 'text-[clamp(46px,6vw,80px)]', 'tracking-[0.01em]', 'max-[620px]:text-[clamp(34px,10vw,46px)]', 'text-[clamp(24px,3.5vw,36px)]', 'max-[620px]:text-[clamp(21px,7vw,29px)]']
  ] as const)('uses locale-tuned banner sizing for %s', (locale, desktopSize, tracking, mobileSize, subtitleSize, subtitleMobileSize) => {
    render(<Hero locale={locale} title="Title" subtitle="Subtitle" />);

    expect(screen.getByRole('heading', {name: 'Title'})).toHaveClass(desktopSize, tracking, mobileSize);
    expect(screen.getByText('Subtitle')).toHaveClass(subtitleSize, subtitleMobileSize, tracking);
  });

  it('uses the larger Traditional Chinese and English banner scale', () => {
    render(<Hero locale="en" title="Title" subtitle="Subtitle" />);

    expect(screen.getByRole('heading', {name: 'Title'})).toHaveClass('text-[clamp(58px,8.5vw,104px)]');
    expect(screen.getByText('Subtitle')).toHaveClass('text-[clamp(26px,3.5vw,40px)]', 'max-[620px]:text-[clamp(22px,7vw,30px)]');
  });
});

describe.each([
  [
    'Klee One',
    'src/assets/fonts/klee-one/SOURCE.md',
    'src/assets/fonts/klee-one/OFL.txt',
    'bf4063f030cc2ae6adf0a11424a1888e5c0eb4438f1f6d02f52294af868e9b3a',
    'src/assets/fonts/klee-one/KleeOne-HHC-Banners.woff2',
    '617fba728b49323e67a57cad09b3819abb896e2e582841d2ad32dca9890d9730'
  ],
  [
    'HHC Pen Hangul',
    'src/assets/fonts/hhc-pen-hangul/SOURCE.md',
    'src/assets/fonts/hhc-pen-hangul/OFL.txt',
    '6f0d1ab29c7894010dc88831fb7a0a51edb79136e450344183de5b1a8b52bd43',
    'src/assets/fonts/hhc-pen-hangul/HHC-Pen-Hangul-Banners.woff2',
    '70ca31913168438ae3005791f992b8a9b73b0cd55dad04b73ef71ad7183fa8d2'
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
