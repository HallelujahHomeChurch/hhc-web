import {render, screen} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {InitialLoadingBoundary} from './InitialLoadingBoundary';

describe('InitialLoadingBoundary', () => {
  it('keeps server-rendered content available behind the branded bootstrap screen', () => {
    const markup = renderToStaticMarkup(
      <InitialLoadingBoundary label="Loading website"><main>Home</main></InitialLoadingBoundary>
    );

    expect(markup).toContain('hhc-brand-loading-screen');
    expect(markup).toContain('Loading website');
    expect(markup).toContain('Home');
    expect(markup).toContain('<noscript><style>.hhc-initial-loading-screen{display:none!important}</style></noscript>');
  });

  it('keeps the initialized app visible when routed content changes', async () => {
    const view = render(
      <InitialLoadingBoundary label="Loading website"><main>Home</main></InitialLoadingBoundary>
    );

    expect(await screen.findByText('Home')).toBeInTheDocument();
    view.rerender(
      <InitialLoadingBoundary label="Loading website"><main>Latest news</main></InitialLoadingBoundary>
    );

    expect(screen.getByText('Latest news')).toBeInTheDocument();
    expect(screen.queryByRole('status', {name: 'Loading website'})).not.toBeInTheDocument();
  });
});
