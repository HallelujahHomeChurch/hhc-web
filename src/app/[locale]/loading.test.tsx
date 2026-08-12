import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

vi.mock('next-intl', () => ({useTranslations: () => (key: string) => key === 'loading' ? 'Loading website' : key}));

import Loading from './loading';

describe('locale loading boundary', () => {
  it('uses the shared branded loading screen and general site copy', () => {
    const {container} = render(<Loading />);
    expect(screen.getByRole('status')).toHaveClass('hhc-brand-loading-screen');
    expect(screen.getByText('Loading website')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', '/assets/brand/logo.png');
  });
});
