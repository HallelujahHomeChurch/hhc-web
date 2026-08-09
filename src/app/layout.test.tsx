import {describe, expect, it} from 'vitest';
import RootLayout from './layout';

describe('RootLayout', () => {
  it('keeps the before-paint theme bootstrap without making the root layout dynamic', () => {
    const layout = RootLayout({children: <main />});

    expect(layout.props.suppressHydrationWarning).toBe(true);
    expect(layout.props.children[0].props.children.props.dangerouslySetInnerHTML.__html).toContain('hhc_theme');
  });
});
