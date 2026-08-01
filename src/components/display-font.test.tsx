import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AboutHero} from './about/AboutHero';
import {HomeHero} from './home/HomeHero';

vi.mock('@/app/fonts', () => ({
  chenyuLuoyan: {className: 'font-chenyuluoyan'},
  maShanZheng: {className: 'font-ma-shan-zheng'}
}));

describe.each([
  ['HomeHero', HomeHero],
  ['AboutHero', AboutHero]
] as const)('%s display font', (_name, Hero) => {
  it.each(['zh-Hant', 'en'] as const)('uses ChenYuluoyan for %s', (locale) => {
    render(<Hero locale={locale} title="Title" subtitle="Subtitle" />);

    expect(screen.getByRole('heading', {name: 'Title'})).toHaveClass('font-chenyuluoyan');
    expect(screen.getByText('Subtitle')).toHaveClass('font-chenyuluoyan');
  });

  it('uses Ma Shan Zheng for zh-Hans', () => {
    render(<Hero locale="zh-Hans" title="Title" subtitle="Subtitle" />);

    expect(screen.getByRole('heading', {name: 'Title'})).toHaveClass('font-ma-shan-zheng');
    expect(screen.getByText('Subtitle')).toHaveClass('font-ma-shan-zheng');
  });
});
