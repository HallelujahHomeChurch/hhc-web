import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import MaintenancePage, {generateMetadata} from './page';

vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));

describe('maintenance page', () => {
  it('renders the localized maintenance status without website navigation', async () => {
    render(await MaintenancePage({params: Promise.resolve({locale: 'zh-Hant'})}));

    expect(screen.getByRole('heading', {name: '網站更新中'})).toBeInTheDocument();
    expect(screen.getByText('我們正在整理網站內容，很快就會再次與你見面。')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /語言/})).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps the temporary route out of search results', async () => {
    const metadata = await generateMetadata({params: Promise.resolve({locale: 'en'})});

    expect(metadata.robots).toEqual({index: false, follow: false});
    expect(metadata.alternates).toBeUndefined();
  });
});
