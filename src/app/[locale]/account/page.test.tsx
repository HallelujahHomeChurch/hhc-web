import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import AccountInfoPage from './page';

vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));
vi.mock('@/components/layout/SiteHeader', () => ({SiteHeader: () => <header />}));
vi.mock('@/components/layout/SiteFooter', () => ({SiteFooter: () => <footer />}));

describe('AccountInfoPage', () => {
  it('publicly explains HHC Account and links its privacy policy', async () => {
    render(await AccountInfoPage({params: Promise.resolve({locale: 'zh-Hant'})}));

    expect(screen.getByRole('heading', {name: 'HHC Account'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Google Sign-In'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '隱私權'})).toHaveAttribute('href', '/zh-Hant/privacy-policy');
  });
});
