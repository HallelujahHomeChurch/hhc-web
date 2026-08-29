import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {describe, expect, it, vi} from 'vitest';
import zhHant from '@/i18n/locales/zh-Hant.json';
import MaintenancePage, {generateMetadata} from './page';

vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));

describe('maintenance page', () => {
  it('renders the localized maintenance status without primary navigation', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        {await MaintenancePage({params: Promise.resolve({locale: 'zh-Hant'})})}
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('heading', {name: '網站更新中'})).toBeInTheDocument();
    expect(screen.getByText('我們正在整理網站內容，很快就會再次與你見面。')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /語言/})).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要導覽'})).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '選單'})).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: '法律資訊'})).toBeInTheDocument();
  });

  it('keeps the temporary route out of search results', async () => {
    const metadata = await generateMetadata({params: Promise.resolve({locale: 'en'})});

    expect(metadata.robots).toEqual({index: false, follow: false});
    expect(metadata.alternates).toBeUndefined();
  });
});
