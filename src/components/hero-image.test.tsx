import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {AboutHero} from './about/AboutHero';
import {HomeHero} from './home/HomeHero';

describe.each([
  ['HomeHero', HomeHero],
  ['AboutHero', AboutHero]
] as const)('%s artwork', (_name, Hero) => {
  it('preloads a responsive decorative image instead of a CSS background', () => {
    const {container} = render(<Hero locale="zh-Hant" title="標題" subtitle="副標題" />);
    const section = container.querySelector('section');
    const image = container.querySelector('img');

    expect(section?.style.backgroundImage).toBe('');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('sizes', '100vw');
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image?.getAttribute('src')).toContain('hero.jpg');
  });
});
