import {render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {TranslationNotice} from './TranslationNotice';

afterEach(() => sessionStorage.clear());

function renderNotice(locale: 'zh-Hant' | 'en' | 'ja' | 'ko', message = 'AI notice') {
  return render(<TranslationNotice locale={locale} message={message} dismissLabel="Dismiss" regionLabel="Translation notice" />);
}

describe('TranslationNotice', () => {
  it.each(['en', 'ja', 'ko'] as const)('shows once per session for %s', async (locale) => {
    const first = renderNotice(locale);
    expect(await screen.findByRole('status')).toHaveTextContent('AI notice');
    first.unmount();

    renderNotice(locale);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('does not show for Chinese locales', async () => {
    renderNotice('zh-Hant');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
