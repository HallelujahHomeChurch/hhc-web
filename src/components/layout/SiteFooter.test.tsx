import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {describe, expect, it} from 'vitest';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {siteConfig} from '@/lib/site';
import {SiteFooter} from './SiteFooter';

describe('SiteFooter', () => {
  it('renders brand, custom language selector, and social links without footer navigation', () => {
    const {container} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteFooter locale="zh-Hant" pathname="/zh-Hant/about" />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('哈利路亞家教會')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '關於我們'})).not.toBeInTheDocument();
    expect(screen.queryByText('語言')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: '語言'})).toHaveTextContent('繁中');
    expect(container.querySelector('select')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'YouTube'})).toHaveAttribute('href', siteConfig.social.youtube);
    expect(screen.getByRole('link', {name: 'Facebook'})).toHaveAttribute('href', siteConfig.social.facebook);
  });
});
