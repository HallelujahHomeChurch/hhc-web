import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {DownloadButton} from './DownloadButton';

describe('DownloadButton', () => {
  it('uses a native download link and gives immediate local feedback', () => {
    render(<DownloadButton href="/assets/weekly.pdf" label="下載週報" pendingLabel="準備下載…" />);

    const link = screen.getByRole('link', {name: '下載週報'});
    expect(link).toHaveAttribute('download', '');

    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.getByRole('link', {name: '準備下載…'})).toHaveAttribute('href', '/assets/weekly.pdf');
  });
});
