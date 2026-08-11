import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {LanguageSwitcher} from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('selects once, closes, restores focus, and disables while navigating', async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<LanguageSwitcher label="語言" locale="zh-Hant" pathname="/zh-Hant" navigate={navigate} />);

    const trigger = screen.getByRole('button', {name: /繁體中文/});
    await user.click(trigger);
    await user.click(screen.getByRole('option', {name: '日本語'}));
    await user.click(trigger);

    expect(trigger).toHaveTextContent('日本語');
    expect(trigger).toBeDisabled();
    expect(trigger.closest('[aria-busy="true"]')).not.toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/ja');
  });
});
