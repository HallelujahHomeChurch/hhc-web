import {render} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {AboutHero} from './about/AboutHero';
import {HomeHero} from './home/HomeHero';

describe.each([
  ['HomeHero', HomeHero],
  ['AboutHero', AboutHero]
] as const)('%s artwork', (_name, Hero) => {
  it('loads the responsive decorative image eagerly without emitting a preload resource', () => {
    const {container} = render(<Hero locale="zh-Hant" title="標題" subtitle="副標題" />);
    const markup = renderToStaticMarkup(<Hero locale="zh-Hant" title="標題" subtitle="副標題" />);
    const section = container.querySelector('section');
    const image = container.querySelector('img');
    const picture = container.querySelector('picture');

    expect(section).toHaveClass('relative');
    expect(section?.style.backgroundImage).toBe('');
    expect(picture).toHaveClass('absolute', 'inset-0');
    expect(image?.style.position).toBe('absolute');
    expect(image?.closest('section')).toBe(section);
    expect(image).toHaveAttribute('alt', '');
    expect(markup).not.toContain('rel="preload"');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('sizes', '100vw');
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image?.getAttribute('src')).toContain('hero.jpg');
  });
});

describe('HomeHero mobile bounds', () => {
  it('allows a long Japanese title to wrap inside the mobile shell', () => {
    const {container} = render(<HomeHero locale="ja" title="ハレルヤ・ホームチャーチ" subtitle="愛の中で家庭を築く" />);
    const title = container.querySelector('h1');

    expect(title?.parentElement).toHaveClass('min-w-0');
    expect(title).toHaveClass('max-[620px]:whitespace-normal');
  });
});
