import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {PageNavigation} from './PageNavigation';

const labels = {navigation: 'Pagination', previous: 'Previous', next: 'Next'};

describe('PageNavigation', () => {
  it('links adjacent pages and omits the query for page one', () => {
    render(<PageNavigation basePath="/en/news" page={2} totalPages={3} labels={labels} />);
    expect(screen.getByRole('link', {name: 'Previous'})).toHaveAttribute('href', '/en/news');
    expect(screen.getByRole('link', {name: 'Next'})).toHaveAttribute('href', '/en/news?page=3');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('does not render for a single page', () => {
    const {container} = render(<PageNavigation basePath="/en/news" page={1} totalPages={1} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });
});
