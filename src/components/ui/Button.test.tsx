import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Button} from './Button';

describe('Button', () => {
  it('uses primary as the default CTA variant', () => {
    render(<Button href="/about">認識我們</Button>);

    const link = screen.getByRole('link', {name: '認識我們'});

    expect(link.className).toContain('bg-primary-solid');
    expect(link.className).toContain('text-primary-foreground');
    expect(link.className).toContain('font-semibold');
    expect(link.className).not.toContain('font-extrabold');
    expect(link.className).not.toContain('!');
  });

  it('supports primary soft icon links for social actions', () => {
    render(
      <Button href="https://example.com" ariaLabel="YouTube" size="icon" target="_blank" variant="primarySoft">
        Y
      </Button>
    );

    const link = screen.getByRole('link', {name: 'YouTube'});

    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link.className).toContain('bg-primary-soft');
    expect(link.className).toContain('border-transparent');
    expect(link.className).toContain('text-primary');
    expect(link.className).toContain('size-11');
  });
});

it('includes native pending decoration only for same-tab root-relative links',()=>{
 const {container}=render(<><Button href="/en/about">About</Button><Button href="https://example.com">External</Button><Button href="//example.com">Protocol relative</Button><Button href="/en/about" target="_blank">New tab</Button></>);
 expect(container.querySelectorAll('[data-navigation-pending]')).toHaveLength(1);
 expect(screen.getByRole('link',{name:'About'}).querySelector('[data-navigation-pending]')).not.toBeNull();
 for(const name of ['External','Protocol relative','New tab'])expect(screen.getByRole('link',{name}).querySelector('[data-navigation-pending]')).toBeNull();
});
