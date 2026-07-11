import {describe, expect, it} from 'vitest';
import RootLayout from './layout';

describe('RootLayout', () => {
  it('allows the before-paint theme bootstrap to own html attributes', () => {
    const layout = RootLayout({children: <main />});

    expect(layout.props.suppressHydrationWarning).toBe(true);
  });
});
