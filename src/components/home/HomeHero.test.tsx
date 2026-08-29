import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {HomeHero} from './HomeHero';

describe('HomeHero', () => {
  it('renders the opaque CMS Banner URL as decorative content', () => {
    const {container} = render(<HomeHero locale="en" title="Home" subtitle="Welcome" imageUrl="/api/assets/home-banner/original" />);

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image?.getAttribute('src')).toContain('%2Fapi%2Fassets%2Fhome-banner%2Foriginal');
  });

  it('keeps the checked-in Banner for v1 compatibility', () => {
    const {container} = render(<HomeHero locale="en" title="Home" subtitle="Welcome" />);

    expect(container.querySelector('img')?.getAttribute('src')).toContain('%2Fassets%2Fbanners%2Fhero.jpg');
  });
});
