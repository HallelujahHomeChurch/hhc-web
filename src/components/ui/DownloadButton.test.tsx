import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {DownloadButton} from './DownloadButton';

describe('DownloadButton', () => {
  it('keeps its label and dimensions while preventing duplicate downloads', () => {
    render(<DownloadButton href="/assets/weekly.pdf" label="下載週報" />);

    const link = screen.getByRole('link', {name: '下載週報'});
    expect(link).toHaveAttribute('download', '');

    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('href', '/assets/weekly.pdf');
    expect(link.querySelector('[data-download-spinner]')).toBeInTheDocument();
    expect(fireEvent.click(link)).toBe(false);
  });
});
