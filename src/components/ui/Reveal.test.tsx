import {render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Reveal} from './Reveal';

describe('Reveal', () => {
  it('renders content visibly when IntersectionObserver is unavailable', async () => {
    render(<Reveal>內容</Reveal>);

    await waitFor(() => expect(screen.getByText('內容')).toHaveAttribute('data-visible', 'true'));
  });
});
