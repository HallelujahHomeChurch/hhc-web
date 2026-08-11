import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {LegalPageShell} from './LegalPageShell';

describe('LegalPageShell', () => {
  it('renders a standalone legal layout with the shared utility locale selector', async () => {
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

    const trigger = screen.getByRole('button', {name: /語言/});
    expect(trigger).toHaveClass('hhc-select__trigger--utility');
    expect(trigger).not.toHaveClass('legal-language-trigger', 'site-language-trigger');
    expect(trigger).toHaveAccessibleName(/繁體中文/);

    await user.click(trigger);
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(5);
    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
      '繁體中文',
      '简体中文',
      'English',
      '日本語',
      '한국어'
    ]);
    expect(screen.getByRole('option', {name: '繁體中文'})).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option', {name: 'English'})).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('option', {name: 'English'})).toBeInTheDocument();
  });
});
