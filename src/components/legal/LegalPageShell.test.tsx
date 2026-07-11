import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {LegalPageShell} from './LegalPageShell';

describe('LegalPageShell', () => {
  it('renders a standalone legal layout with a dismissible locale selector', async () => {
    const user = userEvent.setup();

    render(
      <LegalPageShell
        languageLabel="語言"
        locale="zh-Hant"
        pathname="/zh-Hant/privacy-policy"
        siteName="哈利路亞家教會"
      >
        <article>法律內容</article>
      </LegalPageShell>
    );

    expect(screen.getByRole('link', {name: '哈利路亞家教會'})).toHaveAttribute('href', '/zh-Hant');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('法律內容')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', {name: '語言'}));
    expect(await screen.findByRole('option', {name: 'EN'})).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option', {name: 'EN'})).not.toBeInTheDocument();
  });
});
