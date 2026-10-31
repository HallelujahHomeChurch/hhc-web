import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import LocaleError from './error';

const captureException = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({captureException}));

function renderError(locale: 'en' | 'ja', error: Error & {digest?: string}, reset = vi.fn()) {
  render(
    <NextIntlClientProvider locale={locale} messages={{site: getMessages(locale).site}}>
      <LocaleError error={error} reset={reset} />
    </NextIntlClientProvider>
  );
  return reset;
}

afterEach(() => captureException.mockReset());

describe('LocaleError', () => {
  it('renders the visitor locale with retry and home actions', async () => {
    const reset = renderError('ja', new Error('render failed'));
    const copy = getMessages('ja').site;
    expect(screen.getByRole('heading', {name: copy.pageError.title})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: copy.nav.home})).toHaveAttribute('href', '/ja');
    await userEvent.click(screen.getByRole('button', {name: copy.pageError.retry}));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('reports client-only failures once and leaves server digests to onRequestError', () => {
    renderError('en', new Error('client failure'));
    expect(captureException).toHaveBeenCalledOnce();
    captureException.mockReset();
    renderError('en', Object.assign(new Error('server failure'), {digest: '123'}));
    expect(captureException).not.toHaveBeenCalled();
  });
});
